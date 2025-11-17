const {Command, InvalidArgumentError} = require("commander");
const url = require("url");
const superagent = require("superagent");
const http = require("http");
const fs = require("fs").promises;
const files = require("fs");
const path = require("path");
const formidable = require("formidable");
const express = require("express");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const cors = require('cors');

const program = new Command;

program
    .requiredOption('-h, --host <host>','server host')
    .requiredOption('-p, --port <port>', 'server port')
    .requiredOption('-c, --cache <cache>', 'server cache');

program.parse(process.argv);

const options = program.opts();

// --- Express для Swagger ---
const app = express();
app.use(cors());

// --- Swagger ---
// const swaggerDefinition = {
//   openapi: '3.0.0',
//   info: { title: 'Inventory API', version: '1.0.0', description: 'API для управління інвентарем' },
//   servers: [{ url: `http://localhost:${options.port}` }],
// };

const swaggerDefinition = {
  openapi: '3.0.0',
  info: { title: 'Inventory API', version: '1.0.0', description: 'API для управління інвентарем' },
  servers: [{ url: `http://127.0.0.1:${options.port}` }], // Docker-friendly
};

const swaggerSpec = swaggerJsdoc({
  swaggerDefinition,
  apis: ['./index.js'], 
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


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
    /**
     * @swagger
     * /:
     *   get:
     *     summary: Головна сторінка сервера
     *     description: Повертає HTML файл index.html
     *     responses:
     *       200:
     *         description: HTML сторінка успішно отримана
     *         content:
     *           text/html:
     *             schema:
     *               type: string
     *       404:
     *         description: Файл не знайдено
     */

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
    /**
     * @swagger
     * /RegisterForm.html:
     *   get:
     *     summary: Сторінка форми реєстрації предмету
     *     responses:
     *       200:
     *         description: HTML форма успішно отримана
     *         content:
     *           text/html:
     *             schema:
     *               type: string
     *       404:
     *         description: Файл не знайдено
     */

    /**
     * @swagger
     * /SearchForm.html:
     *   get:
     *     summary: Сторінка форми пошуку предмету
     *     responses:
     *       200:
     *         description: HTML форма успішно отримана
     *         content:
     *           text/html:
     *             schema:
     *               type: string
     *       404:
     *         description: Файл не знайдено
     */


    if (req.url === "/RegisterForm.html" || req.url === "/SearchForm.html") {
        try {
            const html = await fs.readFile(req.url.substring(1)); 
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(html);
        } catch {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("file not found");
        }
        return;
    }
    /**
     * @swagger
     * /inventory:
     *   get:
     *     summary: Повертає список всіх предметів інвентарю
     *     responses:
     *       200:
     *         description: Список предметів успішно отримано
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   id:
     *                     type: integer
     *                   name:
     *                     type: string
     *                   description:
     *                     type: string
     */


    if (req.url.startsWith("/inventory")) {
        try {
            const { inventory, parts, id, item } = await getInventoryItem(req);

            if (req.url === "/inventory") {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(inventory));
                return;
            }
            /**
             * @swagger
             * /inventory/{id}/photo:
             *   get:
             *     summary: Повертає фото предмету за ID
             *     parameters:
             *       - in: path
             *         name: id
             *         required: true
             *         schema:
             *           type: integer
             *         description: ID предмету
             *     responses:
             *       200:
             *         description: Фото успішно отримано
             *         content:
             *           image/jpeg:
             *             schema:
             *               type: string
             *               format: binary
             *       404:
             *         description: Фото не знайдено
             */


            if (req.url.startsWith("/inventory/") && req.url.endsWith("/photo")) {
                if (parts.length !== 3 || !item || !item.photoPath) {
                    res.writeHead(404, { "Content-Type": "text/plain" });
                    res.end("file not found");
                    return;
                }

                const photoPath = path.resolve(item.photoPath.replace(/\\/g, '/'));
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
            /**
             * @swagger
             * /inventory/{id}:
             *   get:
             *     summary: Повертає предмет за ID
             *     parameters:
             *       - in: path
             *         name: id
             *         required: true
             *         schema:
             *           type: integer
             *         description: ID предмету
             *     responses:
             *       200:
             *         description: Предмет знайдено
             *         content:
             *           application/json:
             *             schema:
             *               type: object
             *               properties:
             *                 id:
             *                   type: integer
             *                 name:
             *                   type: string
             *                 description:
             *                   type: string
             *                 photo:
             *                   type: string
             *                   description: Посилання на фото предмету (якщо є)
             *       404:
             *         description: Предмет не знайдено
             */


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
        /**
         * @swagger
         * /inventory/{id}/photo:
         *   put:
         *     summary: Оновлює фото предмету
         *     parameters:
         *       - in: path
         *         name: id
         *         required: true
         *         schema:
         *           type: integer
         *     requestBody:
         *       content:
         *         image/jpeg:
         *           schema:
         *             type: string
         *             format: binary
         *     responses:
         *       201:
         *         description: Фото оновлено успішно
         *       404:
         *         description: Предмет або фото не знайдено
         */
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
        /**
         * @swagger
         * /inventory/{id}:
         *   put:
         *     summary: Оновлює дані предмету
         *     parameters:
         *       - in: path
         *         name: id
         *         required: true
         *         schema:
         *           type: integer
         *     requestBody:
         *       content:
         *         application/json:
         *           schema:
         *             type: object
         *             properties:
         *               name:
         *                 type: string
         *               description:
         *                 type: string
         *     responses:
         *       200:
         *         description: Предмет оновлено успішно
         *       400:
         *         description: Неправильні дані
         *       404:
         *         description: Предмет не знайдено
         */
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
    /**
     * @swagger
     * /register:
     *   post:
     *     summary: Додає новий предмет
     *     requestBody:
     *       required: true
     *       content:
     *         multipart/form-data:
     *           schema:
     *             type: object
     *             properties:
     *               inventory_name:
     *                 type: string
     *               description:
     *                 type: string
     *               photo:
     *                 type: string
     *                 format: binary
     *     responses:
     *       201:
     *         description: Предмет додано успішно
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 id:
     *                   type: integer
     *                 name:
     *                   type: string
     *                 description:
     *                   type: string
     *                 photo:
     *                   type: string
     *       400:
     *         description: Неправильні дані
     */

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
            keepExtensions: true,
            allowEmptyFiles: true, 
            minFileSize: 0,  
        });

        form.parse(req, async (err, fields, fileFields) => {
            if (err) {
                res.writeHead(400, { "Content-Type": "text/plain" });
                console.log(err);
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
                            photoPath = newFilePath.replace(/\\/g, '/');
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
        return; 
    }
    /**
     * @swagger
     * /search:
     *   post:
     *     summary: Пошук предмету за ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/x-www-form-urlencoded:
     *           schema:
     *             type: object
     *             properties:
     *               id:
     *                 type: integer
     *               has_photo:
     *                 type: boolean
     *     responses:
     *       200:
     *         description: Предмет знайдено
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 id:
     *                   type: integer
     *                 name:
     *                   type: string
     *                 description:
     *                   type: string
     *                 photo:
     *                   type: string
     *       404:
     *         description: Предмет не знайдено
     */


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
            const id = Number(formData.get("id"));              
            const hasPhoto = formData.get("has_photo") === "true"; 
            
            const foundItem = inventory.find(obj => obj.id === id);
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

            const photoPath = foundItem.photoPath ? path.resolve(foundItem.photoPath.replace(/\\/g, '/')) : null;
            if (hasPhoto && photoPath && files.existsSync(photoPath)) {
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
    /**
     * @swagger
     * /inventory/{id}:
     *   delete:
     *     summary: Видаляє предмет за ID
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: Предмет видалено успішно
     *       404:
     *         description: Предмет не знайдено
     */

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

        if (req.method === 'OPTIONS') {
            res.writeHead(204); 
            res.end();
            return;
        }

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

app.use(async (req, res, next) => {
    try {
        await inventoryAll(req, res);
    } catch (err) {
        next(err);
    }
});

// --- Запуск сервера ---
app.listen(Number(options.port), options.host || "0.0.0.0", () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
  console.log(`Swagger docs at http://${options.host}:${options.port}/docs`);
});