"use client";

import Link from "@/components/static-link";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Headphones, Home, LoaderCircle, MessageCircle, Mic, Send, Volume2, VolumeX, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import { useBackupAuth } from "@/components/backup-auth-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getLiveApiErrorMessage,
  sendConciergeChat,
  sendConciergeVoiceMessage,
  type ConciergeAgentMode,
  type ConciergeChatResponse,
  type ConciergeSpeechOutput,
  type ConciergeVoiceResponse,
} from "@/lib/live-api";
import { cn } from "@/lib/utils";

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0?: {
      transcript?: string;
    };
  }>;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

const conciergeModes: Array<{ id: ConciergeAgentMode; label: string; icon: typeof MessageCircle }> = [
  { id: "concierge", label: "Concierge", icon: MessageCircle },
  { id: "cigar_guide", label: "Cigar", icon: Bot },
  { id: "support", label: "Support", icon: Headphones },
  { id: "humidor", label: "Humidor", icon: Home },
];

const recorderMimeTypes = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
];

type ConciergeResponse = ConciergeChatResponse | ConciergeVoiceResponse;

export function FloatingConcierge() {
  const auth = useBackupAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ConciergeAgentMode>("concierge");
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<ConciergeResponse | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const transcriptRef = useRef("");
  const finalTranscriptPartsRef = useRef<string[]>([]);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      stopRecordingTracks();
      speechRecognitionRef.current?.abort();
      audioRef.current?.pause();
    };
  }, []);

  async function handleTextSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextMessage = message.trim();
    if (!nextMessage) {
      setStatusMessage("Enter a message for the Yuzu concierge.");
      return;
    }

    if (!canUseLiveConcierge(auth.authSource)) {
      setStatusMessage("Sign in with Cognito before using the live concierge.");
      return;
    }

    setIsSending(true);
    setStatusMessage("");

    try {
      const headers = await auth.createApiHeaders();
      const nextResponse = await sendConciergeChat(
        {
          message: nextMessage,
          agent: mode,
          conversationId: conversationId || undefined,
          voiceOutput: voiceEnabled,
        },
        headers
      );

      commitResponse(nextResponse);
      setMessage("");
      await playSpeech(nextResponse.voice?.speech);
    } catch (error) {
      setStatusMessage(getLiveApiErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  }

  async function startRecording() {
    if (!canUseLiveConcierge(auth.authSource)) {
      setStatusMessage("Sign in with Cognito before using voice concierge.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatusMessage("Voice recording is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      chunksRef.current = [];
      transcriptRef.current = "";
      finalTranscriptPartsRef.current = [];
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const durationMs = Date.now() - recordingStartedAtRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        stopRecordingTracks();
        void sendRecordedVoice(blob, durationMs);
      };

      startSpeechRecognition();
      recorder.start();
      setIsRecording(true);
      setStatusMessage("Listening...");
    } catch {
      stopRecordingTracks();
      setIsRecording(false);
      setStatusMessage("Microphone access was not available.");
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    speechRecognitionRef.current?.stop();
    setIsRecording(false);
    setStatusMessage("Processing voice message...");

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }

    stopRecordingTracks();
  }

  async function sendRecordedVoice(blob: Blob, durationMs: number) {
    if (!blob.size) {
      setStatusMessage("No voice message was captured.");
      return;
    }

    setIsSending(true);

    try {
      const audioBase64 = await readBlobAsBase64(blob);
      const headers = await auth.createApiHeaders();
      const nextResponse = await sendConciergeVoiceMessage(
        {
          audioBase64,
          mimeType: blob.type || "audio/webm",
          transcriptHint: transcriptRef.current,
          durationMs,
          agent: mode,
          conversationId: conversationId || undefined,
          voiceOutput: voiceEnabled,
        },
        headers
      );

      commitResponse(nextResponse);
      await playSpeech(nextResponse.voice.speech);
    } catch (error) {
      setStatusMessage(getLiveApiErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  }

  function commitResponse(nextResponse: ConciergeResponse) {
    setResponse(nextResponse);
    setConversationId(nextResponse.conversation.id);
    setStatusMessage(nextResponse.conversation.persisted ? "Conversation saved." : formatStatusLabel(nextResponse.conversation.persistence));
  }

  async function playSpeech(speech?: ConciergeSpeechOutput | null) {
    if (!voiceEnabled || !speech?.audioBase64 || speech.status !== "synthesized") {
      return;
    }

    audioRef.current?.pause();
    const audio = new Audio(`data:${speech.mimeType || "audio/mpeg"};base64,${speech.audioBase64}`);
    audioRef.current = audio;

    try {
      await audio.play();
    } catch {
      setStatusMessage("Reply ready. Tap play to hear it.");
    }
  }

  function startSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const interimParts: string[] = [];

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim();
        if (!transcript) {
          continue;
        }

        if (result.isFinal) {
          finalTranscriptPartsRef.current.push(transcript);
        } else {
          interimParts.push(transcript);
        }
      }

      transcriptRef.current = [...finalTranscriptPartsRef.current, ...interimParts].join(" ").trim();
    };
    recognition.onerror = () => undefined;
    recognition.onend = () => undefined;
    recognition.start();
    speechRecognitionRef.current = recognition;
  }

  function stopRecordingTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }

  const canSendText = Boolean(message.trim()) && !isSending && !isRecording;
  const speech = response?.voice?.speech ?? null;
  const isLiveReady = canUseLiveConcierge(auth.authSource);
  const isCartRoute = pathname.startsWith("/cart");

  return (
    <div
      className={cn(
        "fixed right-4 z-[45]",
        isCartRoute ? "bottom-[calc(6.25rem+env(safe-area-inset-bottom))] lg:bottom-4" : "bottom-4"
      )}
    >
      <AnimatePresence initial={false} mode="wait">
        {isOpen ? (
          <motion.aside
            key="concierge-panel"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className="flex max-h-[calc(100vh-2rem)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-yuzu-line bg-yuzu-forest text-yuzu-cream shadow-[0_24px_80px_rgba(0,0,0,0.56)]"
          >
            <header className="flex items-center gap-3 border-b border-yuzu-line px-4 py-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-yuzu-gold/50 bg-yuzu-gold/10 text-yuzu-gold">
                <MessageCircle className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black uppercase tracking-[0.16em] text-yuzu-gold">Yuzu Concierge</p>
                <p className="truncate text-xs text-yuzu-muted">{response ? formatStatusLabel(response.agent) : "Member support"}</p>
              </div>
              <Button className="ml-auto border-yuzu-line text-yuzu-cream" size="icon-sm" type="button" variant="outline" aria-label="Close concierge" onClick={() => setIsOpen(false)}>
                <X />
              </Button>
            </header>

            <div className="grid min-h-0 gap-3 overflow-y-auto p-4">
              <div className="grid grid-cols-4 gap-1">
                {conciergeModes.map((item) => {
                  const Icon = item.icon;
                  const isActive = mode === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={item.label}
                      title={item.label}
                      className={cn(
                        "grid h-10 min-w-0 place-items-center rounded-md border text-yuzu-cream transition",
                        isActive ? "border-yuzu-gold bg-yuzu-gold text-yuzu-ink" : "border-yuzu-line bg-yuzu-night/45 hover:border-yuzu-gold hover:text-yuzu-gold"
                      )}
                      onClick={() => setMode(item.id)}
                    >
                      <Icon className="size-4" />
                    </button>
                  );
                })}
              </div>

              {!isLiveReady ? (
                <div className="grid gap-3 rounded-md border border-yuzu-line bg-yuzu-night/50 p-3 text-sm text-yuzu-muted">
                  <p>Sign in with Cognito to use the live concierge.</p>
                  <Link className="inline-flex h-9 items-center justify-center rounded-md bg-yuzu-gold px-3 text-sm font-black text-yuzu-ink" href="/account">
                    Account
                  </Link>
                </div>
              ) : null}

              <form className="grid gap-2" onSubmit={handleTextSubmit}>
                <Textarea
                  aria-label="Concierge message"
                  className="max-h-36 min-h-24 rounded-md border-yuzu-line bg-yuzu-night text-sm text-yuzu-cream"
                  placeholder="Ask the concierge"
                  value={message}
                  onChange={(event) => {
                    setMessage(event.currentTarget.value);
                    setStatusMessage("");
                  }}
                />
                <div className="grid grid-cols-[auto_auto_1fr_auto] gap-2">
                  <Button
                    className={cn("border-yuzu-line text-yuzu-cream", isRecording && "border-red-400 bg-red-500/15 text-red-100")}
                    disabled={isSending}
                    size="icon-lg"
                    title={isRecording ? "Stop recording" : "Record voice"}
                    type="button"
                    variant="outline"
                    aria-label={isRecording ? "Stop recording" : "Record voice"}
                    onClick={isRecording ? stopRecording : startRecording}
                  >
                    <Mic />
                  </Button>
                  <Button
                    className={voiceEnabled ? "bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" : "border-yuzu-line text-yuzu-cream"}
                    size="icon-lg"
                    title={voiceEnabled ? "Voice on" : "Voice off"}
                    type="button"
                    variant={voiceEnabled ? "default" : "outline"}
                    aria-label={voiceEnabled ? "Turn voice off" : "Turn voice on"}
                    onClick={() => setVoiceEnabled((current) => !current)}
                  >
                    {voiceEnabled ? <Volume2 /> : <VolumeX />}
                  </Button>
                  <p className="min-w-0 self-center truncate text-xs text-yuzu-gold" aria-live="polite">
                    {statusMessage}
                  </p>
                  <Button className="bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" disabled={!canSendText} size="icon-lg" type="submit" aria-label="Send concierge message">
                    {isSending ? <LoaderCircle className="animate-spin" /> : <Send />}
                  </Button>
                </div>
              </form>

              {response ? (
                <div className="grid gap-2 rounded-md border border-yuzu-line/70 bg-yuzu-night/55 p-3">
                  <div className="flex items-center justify-between gap-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-yuzu-muted">
                    <span>{formatStatusLabel(response.agent)}</span>
                    <span>{formatStatusLabel(response.ai.status)}</span>
                  </div>
                  {response.voice && "transcription" in response.voice ? (
                    <p className="text-xs leading-5 text-yuzu-muted">You said: {response.voice.transcription.transcript}</p>
                  ) : null}
                  <p className="text-sm leading-6 text-yuzu-cream">{response.reply}</p>
                  {speech?.audioBase64 ? (
                    <Button className="w-fit border-yuzu-line text-yuzu-cream" size="sm" type="button" variant="outline" onClick={() => playSpeech(speech)}>
                      <Volume2 data-icon="inline-start" />
                      Play
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </motion.aside>
        ) : (
          <motion.button
            key="concierge-launcher"
            initial={false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.94 }}
            whileHover={{ y: -3, scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            transition={{
              opacity: { duration: 0.2 },
              y: { type: "spring", stiffness: 260, damping: 22 },
              scale: { type: "spring", stiffness: 260, damping: 22 },
            }}
            type="button"
            data-concierge-launcher="sitewide"
            className="grid size-14 place-items-center rounded-lg border border-yuzu-gold bg-yuzu-gold text-yuzu-ink shadow-[0_18px_52px_rgba(0,0,0,0.5)] transition hover:bg-yuzu-gold-light"
            aria-label="Open Yuzu Concierge"
            onClick={() => setIsOpen(true)}
          >
            <MessageCircle className="size-6" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function canUseLiveConcierge(authSource: "cognito" | "backup" | null) {
  return authSource === "cognito";
}

function getSupportedRecorderMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  return recorderMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "";
}

function readBlobAsBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Unable to read voice message."));
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",").pop() || "" : result);
    };
    reader.readAsDataURL(blob);
  });
}

function formatStatusLabel(value: string) {
  return value
    .replace(/^YCC/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
}
