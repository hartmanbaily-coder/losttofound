"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function ExchangeTimingChart({
  rows,
}: {
  rows: Array<{ date: string; minutesEarlyOrLate: number; status: string }>;
}) {
  if (rows.length === 0) return <ChartEmpty label="No exchange records in this range." />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar
          dataKey="minutesEarlyOrLate"
          name="Minutes early or late"
          fill="#0f766e"
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SupportPaymentChart({
  rows,
}: {
  rows: Array<{ month: string; amountDue: number; amountPaid: number; unpaidBalance: number }>;
}) {
  if (rows.length === 0) return <ChartEmpty label="No child support payment records in this range." />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="amountDue"
          name="Amount due"
          stroke="#334155"
          fill="#cbd5e1"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="amountPaid"
          name="Amount paid"
          stroke="#0f766e"
          fill="#99f6e4"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ExpenseCategoryChart({
  rows,
}: {
  rows: Array<{ category: string; amount: number }>;
}) {
  if (rows.length === 0) return <ChartEmpty label="No expenses in this range." />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} layout="vertical" margin={{ left: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={92} />
        <Tooltip />
        <Bar
          dataKey="amount"
          name="Expense amount"
          fill="#f59e0b"
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SupportTrendLine({
  rows,
}: {
  rows: Array<{ month: string; amountDue: number; amountPaid: number; unpaidBalance: number }>;
}) {
  if (rows.length === 0) return <ChartEmpty label="No monthly payment rows yet." />;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="amountDue"
          name="Due"
          stroke="#334155"
          strokeWidth={2}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="amountPaid"
          name="Paid"
          stroke="#0f766e"
          strokeWidth={2}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="unpaidBalance"
          name="Unpaid balance based on records"
          stroke="#b45309"
          strokeWidth={2}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="grid h-[220px] place-items-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      {label}
    </div>
  );
}
