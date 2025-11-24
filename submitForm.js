import fetch from "node-fetch";

const GITHUB_USER = "contactgreenagrotech-cmd";
const GITHUB_REPO = "green-agrotech-gat";
const GITHUB_FILEPATH = "data/members.json";
const GITHUB_TOKEN = "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";

const RESEND_API_KEY = "reK5FHpxRn_G6m4y7CMXZ2Kaxa9qz9TqhHS";
const EMAIL_FROM = "contact.greenagrotech@gmail.com";
const EMAIL_TO = "contact.greenagrotech@gmail.com";

export async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  // --- 1. Récupérer le contenu actuel de members.json depuis GitHub ---
  const fileUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${GITHUB_FILEPATH}`;

  const getFile = await fetch(fileUrl, {
    headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!getFile.ok) return { statusCode: 500, body: "Cannot fetch members.json" };

  const fileJson = await getFile.json();
  const content = Buffer.from(fileJson.content, "base64").toString("utf8");
  let members = [];
  try { members = JSON.parse(content); } catch (err) { members = []; }

  // --- 2. Ajouter le nouvel adhérent ---
  const newMember = {
    id: `ADH-${new Date().toISOString().slice(0,10)}-${("000"+(members.length+1)).slice(-3)}`,
    timestamp: new Date().toISOString(),
    ...data
  };
  members.push(newMember);

  // --- 3. Push sur GitHub ---
  const updateResponse = await fetch(fileUrl, {
    method: "PUT",
    headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" },
    body: JSON.stringify({
      message: `Add new member ${newMember.id}`,
      content: Buffer.from(JSON.stringify(members, null, 2)).toString("base64"),
      sha: fileJson.sha
    })
  });
  if (!updateResponse.ok) return { statusCode: 500, body: "Cannot update members.json" };

  // --- 4. Envoyer un email via Resend ---
  const emailBody = `
    Nouveau membre GAT enregistré :\n
    ID : ${newMember.id}\n
    Nom : ${data.identity_name}\n
    Email : ${data.contact_email}\n
    Téléphone : ${data.contact_phone}\n
    Date : ${new Date().toLocaleString()}
  `;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [EMAIL_TO],
      subject: `Nouvel adhérent GAT: ${newMember.id}`,
      text: emailBody
    })
  });

  if (!resendResponse.ok) console.error("Erreur Resend", await resendResponse.text());

  // --- 5. Réponse Netlify ---
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Member registered successfully", memberId: newMember.id })
  };
}
