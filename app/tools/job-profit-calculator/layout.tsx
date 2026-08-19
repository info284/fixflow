import type { Metadata } from "next";

export const metadata: Metadata = {
title: "Job Profit Calculator for Trades | FixFlow",
description:
"Use FixFlow's free job profit calculator to estimate profit and profit margin after materials, labour, other job costs and optional VAT adjustment.",
};

export default function JobProfitCalculatorLayout({
children,
}: {
children: React.ReactNode;
}) {
return children;
}