import type { Metadata } from "next";

export const metadata: Metadata = {
title: "Day Rate Calculator for Trades | FixFlow",
description:
"Use FixFlow's free day rate calculator to work out what you should charge per day based on your income target, overheads, billable days and profit buffer.",
};

export default function DayRateCalculatorLayout({
children,
}: {
children: React.ReactNode;
}) {
return children;
}