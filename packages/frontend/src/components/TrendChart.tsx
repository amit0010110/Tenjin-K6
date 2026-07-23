import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuthStore } from '../stores/authStore';

interface Props {
  pid: string;
  hours?: number;
}

export default function TrendChart({ pid, hours }: Props) {
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qs = hours ? `?hours=${hours}` : '';
    fetch(`/api/v1/projects/${pid}/dashboard/trend${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((points) => {
        setData(
          points
            .reverse()
            .map((p: any) => ({
              ...p,
              label: new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pid, token, hours]);

  if (loading) return <div className="text-sm text-gray-400">Loading trend...</div>;
  if (data.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="font-semibold text-sm mb-4">http_req_duration Trend {hours ? `(last ${hours}h)` : '(last 30 runs)'}</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} unit="ms" />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="duration" name="Avg" stroke="#3B82F6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="p95" name="p95" stroke="#F59E0B" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="p99" name="p99" stroke="#EF4444" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
