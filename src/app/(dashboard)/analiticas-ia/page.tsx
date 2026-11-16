"use client";

import { Brain } from "lucide-react";
import PremiumSection from "@/components/dashboard/PremiumSection";

export default function AnaliticasIaPage() {
  return (
    <PremiumSection
      title="Analíticas IA"
      subtitle="Predicciones de churn, detección de patrones de abandono y recomendaciones automáticas para retener socios antes de que se vayan."
      plan="Pro"
      icon={Brain}
      benefits={[
        "Modelo predictivo de churn entrenado con tu histórico",
        "Segmentación automática: en riesgo, fieles, inactivos dormidos",
        "Recomendaciones accionables: a quién llamar, qué ofrecer, cuándo",
        "Forecast de ingresos a 30/60/90 días",
        "Análisis de cohortes y LTV por canal de adquisición",
      ]}
      preview={[
        {
          title: "Socios en riesgo",
          body: "12 socios con probabilidad >70% de cancelar este mes. Ver lista ordenada por valor histórico.",
        },
        {
          title: "Patrones detectados",
          body: "Los socios que reservan menos de 2 clases en su primer mes tienen 3x más riesgo de baja.",
        },
        {
          title: "Acción recomendada",
          body: "Enviar descuento a 4 socios inactivos últimos 14 días. ROI esperado: 240€/mes.",
        },
      ]}
    />
  );
}
