// Cargar variables de entorno
require('dotenv').config();

const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// Variables desde el .env
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PORT = process.env.PORT || 3000;

// 👉 Ruta GET para la verificación de Facebook
app.get("/webhook", (req, res) => {
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Webhook verificado correctamente.");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// 👉 Ruta POST para recibir mensajes
app.post("/webhook", (req, res) => {
  let body = req.body;

  if (body.object === "page") {
    body.entry.forEach(entry => {
      let webhookEvent = entry.messaging[0];
      let sender_psid = webhookEvent.sender.id;

      if (webhookEvent.message) {
        handleMessage(sender_psid, webhookEvent.message);
      }
    });

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// 👉 Función para responder mensajes
function handleMessage(sender_psid, received_message) {
  let response = {
    text: "🐶 Bienvenido a *CASIS accesorios para tu mascota*. Gracias por escribirnos ❤️"
  };

  callSendAPI(sender_psid, response);
}

// 👉 Llamar a la API de Facebook
function callSendAPI(sender_psid, response) {
  let request_body = {
    recipient: { id: sender_psid },
    message: response
  };

  fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request_body),
  })
    .then(res => res.json())
    .then(json => {
      console.log("📩 Mensaje enviado:", json);
    })
    .catch(err => {
      console.error("❌ Error al enviar mensaje:", err);
    });
}

// 👉 Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running on port ${PORT}`);
});
