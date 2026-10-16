"use client";

import React, { useEffect, useState } from "react";
import { Star } from "lucide-react";
import Link from "next/link";
import NumberFlow from "@number-flow/react";
import { Button } from "./button";
import { useI18n } from "@/lib/i18n/context";
import { api } from "@/lib/api";

export function CTA11() {
  const { t } = useI18n();
  const [stats, setStats] = useState({ challenges: 12, hints: 0 });
  useEffect(() => {
    api
      .stats()
      .then((s) => setStats({ challenges: s.challenges, hints: s.hints }))
      .catch(() => {});
  }, []);

  return (
    <section className="border-t border-neutral-200/50 bg-neutral-50 py-16 md:py-24">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 text-center sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <p className="text-xs font-semibold italic tracking-wide text-neutral-500 sm:text-sm">{t("cta11.trustedBy")}</p>
        </div>
        <h2 className="max-w-2xl text-4xl font-medium leading-none tracking-tight text-neutral-900 sm:text-5xl md:text-6xl">{t("cta11.heading")}</h2>
        <p className="mt-3 max-w-lg text-base text-neutral-500 sm:text-lg md:text-xl">{t("cta11.body")}</p>
        <div className="my-2 flex w-full max-w-xl flex-col items-center justify-center gap-6 border-y border-neutral-200/60 py-4 sm:flex-row sm:gap-12">
          <div className="text-center">
            <p className="font-mono text-4xl text-neutral-900">
              <NumberFlow value={stats.challenges} />
            </p>
            <p className="text-sm font-semibold tracking-wider text-neutral-500">{t("cta11.m1")}</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-4xl text-neutral-900">
              <NumberFlow value={stats.hints} />
            </p>
            <p className="text-sm font-semibold tracking-wider text-neutral-500">{t("cta11.m2")}</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-4xl text-neutral-900">0</p>
            <p className="text-sm font-semibold tracking-wider text-neutral-500">{t("cta11.m3")}</p>
          </div>
        </div>
        <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild className="h-12 w-full rounded-full bg-neutral-950 px-8 text-sm font-semibold text-white shadow-lg shadow-neutral-950/10 transition duration-200 hover:bg-neutral-800 sm:w-auto">
            <Link href="/practice">{t("cta11.getStarted")}</Link>
          </Button>
          <Button asChild variant="outline" className="h-12 w-full rounded-full border-neutral-200 bg-white px-8 text-sm font-semibold text-neutral-800 shadow-sm transition duration-200 hover:bg-neutral-50 hover:text-black sm:w-auto">
            <Link href="/judges">{t("cta11.viewDemo")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
