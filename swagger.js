const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();

// const swaggerDefinition = {
//   openapi: '3.0.0',
//   info: {
//     title: 'Inventory API',
//     version: '1.0.0',
//     description: 'API для управління інвентарем',
//   },
//   servers: [
//     { url: 'http://localhost:3000' } 
//   ],
// };

const swaggerDefinition = {
  openapi: '3.0.0',
  info: { title: 'Inventory API', version: '1.0.0' },
  servers: [{ url: 'http://0.0.0.0:3000' }], 
};

const optionsSwagger = {
  swaggerDefinition,
  apis: ['./index.js'], 
};

const swaggerSpec = swaggerJsdoc(optionsSwagger);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(3001, '0.0.0.0', () => {
  console.log('Swagger docs доступні за http://localhost:3001/docs');
});

