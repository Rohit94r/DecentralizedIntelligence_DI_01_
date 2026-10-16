"use client";

import React from "react";
import Link from "next/link";
import { GithubIcon } from "@/components/icons/github-icon";
import { XIcon } from "@/components/icons/x-icon";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

const socialLinks = [
  { href: "https://x.com/icancodefyi", label: "X", icon: <XIcon className="size-4" /> },
  { href: "https://github.com/icancodefyi/", label: "Github", icon: <GithubIcon className="size-4" /> },
];

export function Footer() {
  const { t } = useI18n();
  const navLinks = [
    { href: "/practice", label: t("app.practice") },
    { href: "/bug-factory", label: t("app.bugFactory") },
    { href: "/dashboard", label: t("app.dashboard") },
    { href: "/ledger", label: t("app.ledger") },
    { href: "/taxonomy", label: t("app.taxonomy") },
    { href: "/judges", label: t("app.judges") },
  ];

  return (
    <footer className="mx-auto max-w-5xl px-4 md:px-6">
      <div className="flex flex-col gap-6 py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-wide transition-opacity hover:opacity-85 font-gothic">
            {t("common.brand")}
          </Link>
          <div className="flex items-center gap-1">
            {socialLinks.map(({ href, label, icon }) => (
              <Button asChild key={label} size="icon" variant="ghost">
                <a aria-label={label} href={href} target="_blank" rel="noopener noreferrer">
                  {icon}
                </a>
              </Button>
            ))}
          </div>
        </div>
        <nav>
          <ul className="flex flex-wrap gap-4 text-sm font-medium text-muted-foreground md:gap-6">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link className="transition-colors hover:text-black" href={link.href}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="max-w-xl font-instrumental text-xl italic leading-snug text-neutral-600">“{t("footer.quote")}”</p>
      </div>
      <div className="flex flex-col items-start justify-between gap-2 border-t py-4 text-sm text-muted-foreground sm:flex-row sm:items-center">
        <p>{t("footer.rights", { year: new Date().getFullYear() })}</p>
        <p className="inline-flex items-center gap-1">
          <span>{t("footer.builtBy")}</span>
          <a className="inline-flex items-center gap-1 font-semibold text-foreground/80 hover:text-foreground hover:underline" href="https://github.com/icancodefyi/VH26-IMPIC" rel="noreferrer" target="_blank">
            Team IMPIC
          </a>
        </p>
      </div>
    </footer>
  );
}

export default Footer;
