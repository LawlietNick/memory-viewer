import { useEffect, useRef, useCallback } from "react";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  dark?: boolean;
  onScrollRatioChange?: (ratio: number) => void;
}

export function MarkdownEditor({ value, onChange, onSave, dark = true, onScrollRatioChange }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onScrollRatioChangeRef = useRef(onScrollRatioChange);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;
  onScrollRatioChangeRef.current = onScrollRatioChange;

  // Track if update is from external prop change
  const externalUpdate = useRef(false);

  const createView = useCallback(() => {
    if (!containerRef.current) return;
    viewRef.current?.destroy();

    const themeExtensions = dark
      ? [oneDark]
      : [syntaxHighlighting(defaultHighlightStyle)];

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        EditorView.lineWrapping,
        keymap.of([
          ...defaultKeymap,
          indentWithTab,
          { key: "Mod-s", run: () => { onSaveRef.current(); return true; } },
        ]),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        ...themeExtensions,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !externalUpdate.current) {
            onChangeRef.current(update.state.doc.toString());
          }
          if (update.viewportChanged || update.docChanged) {
            const scroller = update.view.scrollDOM;
            const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
            const ratio = maxScroll === 0 ? 0 : scroller.scrollTop / maxScroll;
            onScrollRatioChangeRef.current?.(Math.min(1, Math.max(0, ratio)));
          }
        }),
        EditorView.theme({
          "&": { height: "100%", fontSize: "14px" },
          ".cm-scroller": { overflow: "auto" },
          ".cm-content": { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
          ".cm-gutters": { borderRight: "none" },
        }),
      ],
    });

    viewRef.current = new EditorView({ state, parent: containerRef.current });
  }, [dark]);

  // Create/recreate on dark change
  useEffect(() => {
    createView();
    return () => viewRef.current?.destroy();
  }, [createView]);

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value !== current) {
      externalUpdate.current = true;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
      externalUpdate.current = false;
    }
  }, [value]);

  // Focus on mount
  useEffect(() => {
    setTimeout(() => viewRef.current?.focus(), 50);
  }, []);

  return (
    <div
      ref={containerRef}
      className="markdown-editor-container"
      style={{ height: "100%", minHeight: "100%" }}
    />
  );
}
