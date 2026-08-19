import type { Metadata } from "next";

export const metadata: Metadata = {
title: "Lost Work Calculator for Trades | FixFlow",
description:
"Use FixFlow's free lost work calculator to estimate how much missed enquiries, forgotten quotes and poor follow-up could be costing your trade business.",
};

export default function LostWorkCalculatorLayout({
children,
}: {
children: React.ReactNode;
}) {
return children;
}