"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const REFRESH_INTERVAL_MS = 30000;

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString();
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString();
}

async function fetchJSON(endpoint) {
  const response = await fetch(`${API_URL}${endpoint}`);
  if (!response.ok) throw new Error(`Failed to fetch ${endpoint}`);
  return response.json();
}

function StatCard({ value, label, color }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={{ color }}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function DriftChart({ data, dataKey, title, threshold, thresholdColor }) {
  return (
    <div className="chart-card">
      <h2 className="chart-title">{title}</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
          <YAxis stroke="#9ca3af" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "4px",
            }}
          />
          <ReferenceLine
            y={threshold}
            stroke={thresholdColor}
            strokeDasharray="5 5"
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={thresholdColor}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function AlertItem({ alert }) {
  const isCritical = alert.severity === "critical";

  return (
    <div
      className="alert-item"
      style={{ borderLeftColor: isCritical ? "#ef4444" : "#f59e0b" }}
    >
      <div className="alert-header">
        <span
          className="alert-severity"
          style={{ backgroundColor: isCritical ? "#ef4444" : "#f59e0b" }}
        >
          {alert.severity.toUpperCase()}
        </span>
        <span className="alert-time">{formatDateTime(alert.created_at)}</span>
      </div>
      <p className="alert-message">{alert.message}</p>
    </div>
  );
}

export default function Dashboard() {
  const [state, setState] = useState({
    driftHistory: [],
    alerts: [],
    stats: null,
    latestDrift: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    try {
      const [history, alerts, stats, latest] = await Promise.all([
        fetchJSON("/drift/history"),
        fetchJSON("/alerts"),
        fetchJSON("/stats"),
        fetchJSON("/drift/latest"),
      ]);

      setState({
        driftHistory: history.map((d) => ({
          ...d,
          time: formatTime(d.created_at),
        })),
        alerts,
        stats,
        latestDrift: latest,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setState((prev) => ({ ...prev, loading: false, error: error.message }));
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (state.loading) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  const { driftHistory, alerts, stats, latestDrift } = state;
  const hasActiveAlerts = stats?.unacknowledged_alerts > 0;
  const isDrifting = latestDrift?.status === "drift_detected";

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">Drift Monitor</h1>
        <p className="subtitle">ML model drift detection</p>
      </header>

      <section className="stats-grid">
        <StatCard
          value={stats?.total_inferences || 0}
          label="Inferences"
          color="#3b82f6"
        />
        <StatCard
          value={stats?.total_drift_runs || 0}
          label="Drift Checks"
          color="#3b82f6"
        />
        <StatCard
          value={stats?.unacknowledged_alerts || 0}
          label="Active Alerts"
          color={hasActiveAlerts ? "#ef4444" : "#22c55e"}
        />
        <StatCard
          value={isDrifting ? "DRIFT" : "STABLE"}
          label="Status"
          color={isDrifting ? "#ef4444" : "#22c55e"}
        />
      </section>

      <section className="charts-grid">
        <DriftChart
          data={driftHistory}
          dataKey="kl_divergence"
          title="KL Divergence"
          threshold={0.1}
          thresholdColor="#3b82f6"
        />
        <DriftChart
          data={driftHistory}
          dataKey="cosine_similarity"
          title="Cosine Similarity"
          threshold={0.9}
          thresholdColor="#10b981"
        />
      </section>

      <section className="alerts-card">
        <h2 className="chart-title">Alerts</h2>
        {alerts.length === 0 ? (
          <p className="no-alerts">No alerts</p>
        ) : (
          <div className="alerts-list">
            {alerts.map((alert) => (
              <AlertItem key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </section>

      <style jsx global>{`
        .container {
          min-height: 100vh;
          background-color: #0f172a;
          color: #f8fafc;
          padding: 2rem;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .loading {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-size: 1.5rem;
        }
        .header {
          margin-bottom: 2rem;
        }
        .title {
          font-size: 2rem;
          font-weight: 600;
          margin: 0;
        }
        .subtitle {
          color: #94a3b8;
          margin-top: 0.25rem;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .stat-card {
          background-color: #1e293b;
          border-radius: 8px;
          padding: 1.25rem;
          text-align: center;
        }
        .stat-value {
          font-size: 1.75rem;
          font-weight: 600;
        }
        .stat-label {
          color: #94a3b8;
          margin-top: 0.25rem;
          font-size: 0.875rem;
        }
        .charts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .chart-card {
          background-color: #1e293b;
          border-radius: 8px;
          padding: 1.25rem;
        }
        .chart-title {
          font-size: 1rem;
          font-weight: 500;
          margin: 0 0 1rem 0;
          color: #f8fafc;
        }
        .alerts-card {
          background-color: #1e293b;
          border-radius: 8px;
          padding: 1.25rem;
        }
        .no-alerts {
          color: #94a3b8;
          text-align: center;
          padding: 2rem;
        }
        .alerts-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .alert-item {
          background-color: #0f172a;
          border-radius: 4px;
          padding: 1rem;
          border-left: 3px solid;
        }
        .alert-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .alert-severity {
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          font-size: 0.625rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .alert-time {
          color: #94a3b8;
          font-size: 0.75rem;
        }
        .alert-message {
          margin: 0;
          color: #e2e8f0;
          font-size: 0.875rem;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
