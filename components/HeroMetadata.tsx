"use client";

import { useEffect, useState } from "react";
import packageJson from "@/package.json";

interface HealthData {
  status: "operational" | "degraded" | "unknown";
  latency: number | null;
}

export function HeroMetadata() {
  const [health, setHealth] = useState<HealthData>({
    status: "unknown",
    latency: null,
  });

  useEffect(() => {
    const checkHealth = async () => {
      const start = performance.now();
      try {
        const response = await fetch("/api/health?mode=liveness");
        const end = performance.now();
        const latency = Math.round(end - start);

        if (response.ok) {
          setHealth({ status: "operational", latency });
        } else {
          setHealth({ status: "degraded", latency });
        }
      } catch (error) {
        setHealth({ status: "degraded", latency: null });
      }
    };

    checkHealth();
  }, []);

  const statusColor =
    health.status === "operational"
      ? "bg-green-500"
      : health.status === "degraded"
        ? "bg-yellow-500"
        : "bg-muted";

  const statusText =
    health.status === "operational"
      ? "System Operational"
      : health.status === "degraded"
        ? "System Degraded"
        : "Checking...";

  return (
    <div className="border-l border-border pl-8 space-y-8">
      <div className="space-y-2">
        <div className="text-xs font-mono text-muted uppercase tracking-widest">
          Status
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${statusColor} ${health.status === "operational" ? "animate-pulse" : ""}`}
          />
          <span className="font-medium">{statusText}</span>
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-mono text-muted uppercase tracking-widest">
          Version
        </div>
        <div className="font-mono">v{packageJson.version}</div>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-mono text-muted uppercase tracking-widest">
          Latency
        </div>
        <div className="font-mono">
          {health.latency !== null ? `${health.latency}ms` : "—"}
        </div>
      </div>
    </div>
  );
}
