"use client";

/** Features box 2 — the reference's wheel-picker card, turned into the hint ladder. */
import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WheelPicker, WheelPickerWrapper } from "@/components/wheel-picker";
import { useI18n } from "@/lib/i18n/context";
import { LADDERS } from "./landingData";

export function HintWheelBox() {
  const { t } = useI18n();
  const [challenge, setChallenge] = useState("last-k-total");
  const [rung, setRung] = useState("1");
  const [asked, setAsked] = useState(false);
  const ladder = LADDERS[challenge];
  const challengeOptions = Object.keys(LADDERS).map((k) => ({ label: k, value: k }));
  const rungOptions = ["1", "2", "3", "4"].map((v) => ({ label: `${t("features.rung")} ${v}`, value: v }));

  return (
    <div className="col-span-1 flex h-auto min-h-[420px] items-center justify-center rounded-3xl border border-sky-200/60 bg-sky-100/60 px-4 py-8 sm:px-8 md:col-span-2 md:h-100">
      <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="max-w-[320px] text-left">
          <div className="[&_h3]:leading-[1.18]">
            <h3 className="text-[22px] font-medium leading-[1.08] tracking-[-0.04em] text-[#151515] sm:text-[28px] sm:leading-[1.05] sm:tracking-[-0.045em]">
              <span className="block text-[#0586d2]">{t("features.box2Title1")}</span>
              <span className="block text-[#17152A]">{t("features.box2Title2")}</span>
            </h3>
          </div>
          <p className="mt-3 text-[13.5px] font-medium leading-[1.42] tracking-[-0.02em] text-[#6D6878] sm:text-[15px] sm:leading-[1.45] sm:tracking-[-0.025em]">{t("features.box2Body")}</p>
        </div>

        <div className="w-full max-w-[540px]">
          <div className="flex items-center justify-center gap-2 sm:gap-6">
            <div className="flex min-w-[130px] flex-col items-center rounded-xl bg-white/70 px-2 py-2 shadow-sm sm:min-w-[170px] sm:rounded-2xl sm:px-3 sm:py-3">
              <span className="mb-2 text-[8px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-[10px] sm:tracking-[0.24em]">challenge</span>
              <WheelPickerWrapper className="w-28 sm:w-40">
                <WheelPicker options={challengeOptions} value={challenge} onValueChange={(v: string) => (setChallenge(v), setRung("1"), setAsked(false))} />
              </WheelPickerWrapper>
            </div>
            <div className="flex min-w-[96px] flex-col items-center rounded-xl bg-white/70 px-2 py-2 shadow-sm sm:min-w-[120px] sm:rounded-2xl sm:px-3 sm:py-3">
              <span className="mb-2 text-[8px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-[10px] sm:tracking-[0.24em]">{t("features.rung")}</span>
              <WheelPickerWrapper className="w-20 sm:w-28">
                <WheelPicker options={rungOptions} value={rung} onValueChange={(v: string) => (setRung(v), setAsked(false))} />
              </WheelPickerWrapper>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-left shadow-sm">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#0586d2]/10 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-[#0570b0]">{ladder.tag}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2f7c53]">
                <CheckCircle2 className="size-3.5" /> {t("features.validated")}
              </span>
            </div>
            <p className="min-h-[3.2rem] text-[13px] font-medium leading-[1.5] text-slate-700">{ladder.rungs[Number(rung) - 1]}</p>
            {asked && <p className="mt-1 text-[11.5px] font-semibold text-[#0586d2]">{t("features.answerNote")}</p>}
          </div>

          <div className="mt-3 flex justify-center gap-2">
            <Button
              onClick={() => {
                setAsked(true);
                setRung((r) => String(Math.min(4, Number(r) + 1)));
              }}
              className="rounded-full bg-[#0586d2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0470b5]"
            >
              {t("features.askAnswer")}
            </Button>
            <Button
              onClick={() => (setRung("1"), setAsked(false))}
              variant="outline"
              className="rounded-full border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-black"
            >
              ↺
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
