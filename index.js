const {Command, InvalidArgumentError} = require("commander");
const url = require("url");
const superagent = require("superagent");
const http = require("http");
const fs = require("fs").promises;
const files = require("fs");
const path = require("path");
const formidable = require("formidable");


const program = new Command;

program
    .requiredOption('-h, --host <host>','server host')
    .requiredOption('-p, --port <port>', 'server port')
    .requiredOption('-c, --cache <cache>', 'server cache');

program.parse(process.argv);

const options = program.opts();

if(!files.existsSync(options.cache)){
    files.mkdirSync(options.cache, {recursive:true});
    console.log(`Directory ${options.cache} created`);
}

async function getInventoryItem(req) {
    const data = await fs.readFile("inventory.json", "utf8");
    const inventory = JSON.parse(data);
    const parts = req.url.split("/").filter(Boolean);
    const id = parts[1];
    const item = inventory.find(obj => obj.id == id);
    return { inventory, parts, id, item };
}

async function allGets(req, res) {
    // Головна сторінка
    if (req.url === "/" || req.url === "/index.html") {
        try {
            const html = await fs.readFile("index.html");
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(html);
        } catch {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("file not found");
        }
        return;
    }

    if (req.url === "/RegisterForm.html" || req.url === "/SearchForm.html") {
        try {
            const html = await fs.readFile(req.url.substring(1)); // видаляємо "/"
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(html);
        } catch {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("file not found");
        }
        return;
    }

    if (req.url.startsWith("/inventory")) {
        try {
            const { inventory, parts, id, item } = await getInventoryItem(req);

            if (req.url === "/inventory") {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(inventory));
                return;
            }

            if (req.url.startsWith("/inventory/") && req.url.endsWith("/photo")) {
                if (parts.length !== 3 || !item || !item.photoPath) {
                    res.writeHead(404, { "Content-Type": "text/plain" });
                    res.end("file not found");
                    return;
                }

                const photoPath = path.resolve(item.photoPath);
                if (!files.existsSync(photoPath)) {
                    res.writeHead(404, { "Content-Type": "text/plain" });
                    res.end("file not found");
                    return;
                }

                res.writeHead(200, { "Content-Type": "image/jpeg" });
                const stream = files.createReadStream(photoPath);
                stream.pipe(res);
                return;
            }

            if (req.url.startsWith("/inventory/")) {
                if (!item) {
                    res.writeHead(404, { "Content-Type": "text/plain" });
                    res.end("item not found");
                    return;
                }

                const response = {
                    id: item.id,
                    name: Array.isArray(item.name) ? item.name[0] : item.name,
                    description: Array.isArray(item.description) ? item.description[0] : item.description
                };

                const photoPath = item.photoPath ? path.resolve(item.photoPath.replace(/\\/g, '/')) : null;
                if (photoPath && files.existsSync(photoPath)) {
                    response.photo = `/inventory/${item.id}/photo`;
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
                return;
            }


        } catch {
            res.writeHead(500);
            res.end("server error");
        }
    } else {
        res.writeHead(405, { "Content-Type": "text/plain" });
        res.end("Method not allowed");
    }
}


async function allPut(req, res) {
    const { inventory, parts, id, item } = await getInventoryItem(req);
    const filePath = `${options.cache}/${id}.jpg`;
    let picture = [];
    let body = [];

    try {
        if (req.url.startsWith("/inventory/") && req.url.endsWith("/photo")) {
            if (parts.length !== 3 || !item) {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("item not found");
                return;
            }

            req.on("data", chunk => picture.push(chunk));
            req.on("end", async () => {
                try {
                    const buffer = Buffer.concat(picture);
                    await fs.writeFile(filePath, buffer);

                    item.photoPath = filePath; 
                    await fs.writeFile("inventory.json", JSON.stringify(inventory, null, 2));

                    res.writeHead(201, { "Content-Type": "text/plain" });
                    res.end("photo is saved");
                } catch {
                    res.writeHead(500, { "Content-Type": "text/plain" });
                    res.end("server error");
                }
            });

        }
        else if (req.url.startsWith("/inventory/")) {
            if (parts.length !== 2 || !item) {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("item not found");
                return;
            }

            req.on("data", chunk => body.push(chunk));
            req.on("end", async () => {
                let data;
                try {
                    data = JSON.parse(Buffer.concat(body).toString());
                } catch {
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    res.end("invalid JSON");
                    return;
                }

                if (data.description) item.description = data.description;
                if (data.name) item.name = data.name;

                try {
                    await fs.writeFile("inventory.json", JSON.stringify(inventory, null, 2));
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(item));
                } catch {
                    res.writeHead(500, { "Content-Type": "text/plain" });
                    res.end("server error");
                }
            });

        } else {
            res.writeHead(405, { "Content-Type": "text/plain" });
            res.end("Method not allowed");
        }

    } catch {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("server error");
    }
}

async function allPost(req, res) {
    if (req.url.startsWith("/register")) {
        let inventory = [];
        try {
            const data = await fs.readFile("inventory.json", "utf8");
            inventory = JSON.parse(data);
        } catch {
            inventory = [];
        }

        const form = new formidable.IncomingForm({
            multiples: false,
            uploadDir: options.cache,
            keepExtensions: true
        });

        // ВСЯ обробка відповіді — всередині form.parse
        form.parse(req, async (err, fields, fileFields) => {
            if (err) {
                res.writeHead(400, { "Content-Type": "text/plain" });
                return res.end("Invalid form data");
            }

            try {
                let name = Array.isArray(fields.inventory_name) ? fields.inventory_name[0] : fields.inventory_name;
                let description = Array.isArray(fields.description) ? fields.description[0] : fields.description || "";

                if (!name || !name.trim()) {
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    return res.end("inventory_name is required");
                }

                const maxId = inventory.length > 0 ? Math.max(...inventory.map(i => Number(i.id))) : 0;
                const newId = maxId + 1;

                let photoPath = "";

                if (fileFields.photo) {
                    let file = Array.isArray(fileFields.photo) ? fileFields.photo[0] : fileFields.photo;
                    if (file && file.filepath) {
                        const ext = path.extname(file.originalFilename || ".jpg");
                        const newFilePath = path.join(options.cache, `${newId}${ext}`);
                        try {
                            await fs.rename(file.filepath, newFilePath);
                            photoPath = newFilePath;
                        } catch (err) {
                            console.error("Error saving photo:", err);
                            photoPath = "";
                        }
                    }
                }

                const inventory_item = {
                    id: newId,
                    name: String(name),
                    description: String(description),
                    photoPath
                };

                inventory.push(inventory_item);
                await fs.writeFile("inventory.json", JSON.stringify(inventory, null, 2));

                const response = {
                    id: inventory_item.id,
                    name: inventory_item.name,
                    description: inventory_item.description
                };
                if (photoPath) response.photo = `/inventory/${newId}/photo`;

                res.writeHead(201, { "Content-Type": "application/json" });
                return res.end(JSON.stringify(response));

            } catch (error) {
                console.error("Register error:", error);
                if (!res.headersSent) {
                    res.writeHead(500, { "Content-Type": "text/plain" });
                    return res.end("server error");
                }
            }
        });

        // НЕ ставити ніяких res.end() після form.parse
        return; 
    }

    if (req.url === "/search") {
        let body = [];
        let inventory = [];
        try {
            const data = await fs.readFile("inventory.json", "utf8");
            inventory = JSON.parse(data);
        } catch {
            inventory = [];
        }

        req.on("data", chunk => body.push(chunk));
        req.on("end", async () => {
            const buffer = Buffer.concat(body);
            const formData = new URLSearchParams(buffer.toString());
            const id = formData.get("id");               
            const hasPhoto = formData.get("has_photo") === "true"; 
            
            const foundItem = inventory.find(obj => obj.id == id);
            if (!foundItem) {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("item not found");
                return;
            }

            const response = {
                id: foundItem.id,
                name: Array.isArray(foundItem.name) ? foundItem.name[0] : foundItem.name,
                description: Array.isArray(foundItem.description) ? foundItem.description[0] : foundItem.description
            };

            // перевіряємо, чи файл реально існує
            if (hasPhoto && foundItem.photoPath && files.existsSync(foundItem.photoPath)) {
                response.photo = `/inventory/${id}/photo`;
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
        });
    }

    else {
        res.writeHead(405, { "Content-Type": "text/plain" });
        res.end("Method not allowed");
    }
}


async function deletee(req,res) {
    const { inventory, parts, id, item } = await getInventoryItem(req); 
    if(!item){
        res.writeHead(404, {'Content-type':'text/plain'});
        res.end("item not found");
        return;
    }
    const newInventory = inventory.filter(obj => obj.id != id);
    await fs.writeFile("inventory.json", JSON.stringify(newInventory, null, 2));

    res.writeHead(200, {'Content-Type':'application/json'});
    res.end("item deleted");
}

async function inventoryAll(req, res) {
    try {
        const method = req.method;
        if (method === "GET") {
            await allGets(req, res);
        } else if (method === "PUT") {
            await allPut(req, res);
        } else if (method === "POST") {
            await allPost(req, res);
        } else if (method === "DELETE") {
            await deletee(req, res);
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end("Method not allowed");
        }
    } catch (err) {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end("Server error");
    }
}

const server = http.createServer((req, res)=>{
    inventoryAll(req, res);
});

server.listen(Number(options.port), options.host, ()=>{
    console.log(`Server running at http://${options.host}:${options.port}/`);
})
