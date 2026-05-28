"use client";

import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildContactSupportPayload, sendContactSupportMessage } from "@/lib/contact-support";
import { supportEmail } from "@/lib/seo";

const contactTopics = [
  "Order support",
  "Membership question",
  "Digital humidor help",
  "Event inquiry",
  "Wholesale box request",
  "General question",
];

type ContactStatus = {
  kind: "idle" | "success" | "error";
  message: string;
};

export function ContactUsForm() {
  const [status, setStatus] = useState<ContactStatus>({ kind: "idle", message: "" });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    setSubmitting(true);
    setStatus({ kind: "idle", message: "" });

    try {
      const formData = new FormData(form);
      const payload = buildContactSupportPayload({
        name: clean(formData.get("name")),
        email: clean(formData.get("email")),
        topic: clean(formData.get("topic")),
        orderNumber: clean(formData.get("orderNumber")),
        message: clean(formData.get("message")),
        pagePath: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
      const result = await sendContactSupportMessage(payload);

      if (!result.sent) {
        throw new Error(getContactSendError(result.reason));
      }

      form.reset();
      setStatus({
        kind: "success",
        message: "Email sent. Our support team will reply within one business day.",
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "We could not send this email right now. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="contact-name">
          <Input
            id="contact-name"
            name="name"
            required
            autoComplete="name"
            placeholder="Your name"
            className="h-12 border-yuzu-line/75 bg-yuzu-night/70 px-4 text-yuzu-cream placeholder:text-yuzu-muted/70"
          />
        </Field>
        <Field label="Email" htmlFor="contact-email">
          <Input
            id="contact-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="h-12 border-yuzu-line/75 bg-yuzu-night/70 px-4 text-yuzu-cream placeholder:text-yuzu-muted/70"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_0.9fr]">
        <Field label="Topic" htmlFor="contact-topic">
          <select
            id="contact-topic"
            name="topic"
            required
            className="h-12 w-full border border-yuzu-line/75 bg-yuzu-night/70 px-4 text-sm text-yuzu-cream outline-none transition focus:border-yuzu-gold focus:ring-3 focus:ring-yuzu-gold/30"
            defaultValue={contactTopics[0]}
          >
            {contactTopics.map((topic) => (
              <option key={topic} value={topic} className="bg-yuzu-night text-yuzu-cream">
                {topic}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Order number" htmlFor="contact-order" optional>
          <Input
            id="contact-order"
            name="orderNumber"
            autoComplete="off"
            placeholder="YCC-1042"
            className="h-12 border-yuzu-line/75 bg-yuzu-night/70 px-4 text-yuzu-cream placeholder:text-yuzu-muted/70"
          />
        </Field>
      </div>

      <Field label="Message" htmlFor="contact-message">
        <Textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          rows={7}
          placeholder="Tell us what you need help with."
          className="min-h-44 resize-y border-yuzu-line/75 bg-yuzu-night/70 px-4 py-3 text-yuzu-cream placeholder:text-yuzu-muted/70"
        />
      </Field>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="submit"
          disabled={submitting}
          className="h-12 bg-yuzu-gold px-7 font-black uppercase tracking-[0.16em] text-yuzu-ink hover:bg-yuzu-gold-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send data-icon="inline-start" />
          {submitting ? "Sending" : "Send Email"}
        </Button>
      </div>

      <p
        aria-live="polite"
        className={`min-h-6 text-sm leading-6 ${status.kind === "error" ? "text-red-300" : status.kind === "success" ? "text-yuzu-cream" : "text-yuzu-muted"}`}
      >
        {status.message || `Messages go to ${supportEmail}. We respond within one business day.`}
      </p>
    </form>
  );
}

function Field({
  children,
  htmlFor,
  label,
  optional = false,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
  optional?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={htmlFor} className="text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold">
        {label}
        {optional ? <span className="ml-2 text-yuzu-muted">Optional</span> : null}
      </label>
      {children}
    </div>
  );
}

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getContactSendError(reason: "missing_endpoint" | "request_failed") {
  if (reason === "missing_endpoint") {
    return "The support email service is not configured yet.";
  }

  return "We could not send this email right now. Please try again.";
}
