"use client";

import { useEffect } from "react";
import { useAppLanguage } from "@/lib/i18n/appLanguage";

/**
 * Renders the workspace in English without touching each screen's source:
 * rendered Vietnamese copy (text nodes and a few attributes) is swapped for its
 * English counterpart, and restored when the user switches back to Vietnamese.
 * Elements marked with data-no-auto-i18n (or inputs the user types into) are skipped.
 */

const ATTRS = ["placeholder", "title", "aria-label", "alt"] as const;
type Translator = (input: string) => string;
let translateToEnglish: Translator = (input) => input;

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "NOSCRIPT"]);

const originalText = new WeakMap<Text, string>();
const translatedText = new WeakMap<Text, string>();
const originalAttrs = new WeakMap<Element, Map<string, string>>();
const translatedAttrs = new WeakMap<Element, Map<string, string>>();

const skipped = (el: Element | null) =>
  !el || SKIP_TAGS.has(el.tagName) || Boolean(el.closest("[data-no-auto-i18n],[contenteditable='true']"));

function localizeText(node: Text, english: boolean) {
  if (skipped(node.parentElement)) return;
  const current = node.nodeValue ?? "";
  // A value we did not write means the app re-rendered it: that is the new source text.
  if (!originalText.has(node) || translatedText.get(node) !== current) originalText.set(node, current);
  const source = originalText.get(node) ?? current;
  const next = english ? translateToEnglish(source) : source;
  translatedText.set(node, next);
  if (current !== next) node.nodeValue = next;
}

const attrsSkipped = (el: Element) => Boolean(el.closest("[data-no-auto-i18n],[contenteditable='true']"));

function localizeAttrs(el: Element, english: boolean) {
  if (attrsSkipped(el)) return;
  for (const attr of ATTRS) {
    const current = el.getAttribute(attr);
    if (current == null) continue;
    let originals = originalAttrs.get(el);
    let written = translatedAttrs.get(el);
    if (!originals) originalAttrs.set(el, (originals = new Map()));
    if (!written) translatedAttrs.set(el, (written = new Map()));
    if (!originals.has(attr) || written.get(attr) !== current) originals.set(attr, current);
    const source = originals.get(attr) ?? current;
    const next = english ? translateToEnglish(source) : source;
    written.set(attr, next);
    if (current !== next) el.setAttribute(attr, next);
  }
}

function localizeTree(root: Node, english: boolean) {
  if (root.nodeType === Node.TEXT_NODE) {
    localizeText(root as Text, english);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const element = root as Element;
  localizeAttrs(element, english);
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) localizeText(node as Text, english);
    else localizeAttrs(node as Element, english);
    node = walker.nextNode();
  }
}

export default function AutoLocalizer() {
  const language = useAppLanguage();

  useEffect(() => {
    const english = language === "en";
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;

    if (!english) {
      localizeTree(document.body, false);
      return;
    }

    let cancelled = false;
    let observer: MutationObserver | null = null;
    // The English dictionary is only downloaded when English is selected.
    void import("@/lib/i18n/autoTranslate").then((module) => {
      if (cancelled) return;
      translateToEnglish = module.translateToEnglish;
      localizeTree(document.body, true);
      observer = startObserver();
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [language]);

  return null;
}

function startObserver() {
  {
    const observer = new MutationObserver((mutations) => {
      observer.disconnect();
      for (const mutation of mutations) {
        if (mutation.type === "childList") mutation.addedNodes.forEach((node) => localizeTree(node, true));
        else if (mutation.type === "characterData") localizeText(mutation.target as Text, true);
        else if (mutation.type === "attributes") localizeAttrs(mutation.target as Element, true);
      }
      observe();
    });
    const observe = () =>
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...ATTRS],
      });
    observe();
    return observer;
  }
}
