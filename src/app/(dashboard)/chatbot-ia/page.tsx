"use client";

import { Bot } from "lucide-react";
import PremiumSection from "@/components/dashboard/PremiumSection";

export default function ChatbotIaPage() {
  return (
    <PremiumSection
      title="Chatbot IA"
      subtitle="Un asistente virtual 24/7 que responde dudas de socios, gestiona reservas y cancela clases en nombre del cliente sin que nadie tenga que atender el teléfono."
      plan="Smart"
      icon={Bot}
      benefits={[
        "Respuestas automáticas entrenadas con tus horarios, tarifas y normas",
        "Reserva y cancelación de clases por chat en WhatsApp y web",
        "Derivación inteligente a recepción cuando la IA no es suficiente",
        "Registro de conversaciones y métricas de resolución",
        "Tono y estilo personalizables por gimnasio",
      ]}
      preview={[
        {
          title: "Conversación tipo",
          body: "Socia: ¿A qué hora hay CrossFit mañana? Bot: Mañana a las 07:00, 10:00 y 19:00. ¿Te reservo sitio?",
        },
        {
          title: "Triaje automático",
          body: "El bot detecta consultas de bajas o incidencias de pago y las deriva a tu equipo de cuenta.",
        },
        {
          title: "Base de conocimiento",
          body: "Sube tu FAQ, normas de cancelación y política de credenciales. El bot responde sin inventar.",
        },
      ]}
    />
  );
}
