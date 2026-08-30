import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileCode2, FolderOpen, Redo2, Save, Trash2, Undo2 } from "lucide-react";

type FileHandleLike = {
  name: string;
  createWritable?: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
};

type EditorElement = HTMLElement & { contentEditable: string };

const starterHtml = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My website</title><style>body{font-family:Arial,sans-serif;margin:0;color:#17251e}main{max-width:900px;margin:auto;padding:80px 32px}h1{font-size:48px;margin:0 0 16px}p{font-size:18px;line-height:1.6;color:#526159}.cta{display:inline-block;background:#2e7658;color:white;padding:12px 20px;border-radius:7px}</style></head><body><main><h1>Build something great</h1><p>Open an HTML file or edit this starter page. Double-click text to change it.</p><a class="cta" href="#">Get started</a></main></body></html>`;

function htmlDocument(value: string) {
  const parsed = new DOMParser().parseFromString(value, "text/html");
  if (!parsed.body) parsed.appendChild(parsed.createElement("body"));
  return parsed;
}

function elementLabel(element: Element) {
  const text = (element.textContent || element.getAttribute("alt") || "").trim().replace(/\s+/g, " ");
  return `<${element.tagName.toLowerCase()}>${text ? ` ${text.slice(0, 24)}${text.length > 24 ? "…" : ""}` : ""}`;
}

export default function Index() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileHandleRef = useRef<FileHandleLike | null>(null);
  const siteRef = useRef<HTMLElement | null>(null);
  const [source, setSource] = useState(starterHtml);
  const [fileName, setFileName] = useState("Untitled page");
  const [selected, setSelected] = useState<EditorElement | null>(null);
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [mode, setMode] = useState<"design" | "preview">("design");
  const [tab, setTab] = useState<"style" | "content">("style");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [history, setHistory] = useState<string[]>([starterHtml]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const modeRef = useRef<"design" | "preview">("design");
  const latestHtmlRef = useRef(starterHtml);
  const commitRef = useRef<(nextSource?: string) => void>(() => undefined);

  const syncElements = useCallback(() => {
    const body = siteRef.current;
    if (!body) return;
    setElements(Array.from(body.querySelectorAll<EditorElement>("*:not(style):not(script)")));
  }, []);

  modeRef.current = mode;

  const commit = useCallback((nextSource?: string) => {
    const body = siteRef.current;
    if (!body) return;
    const doc = body.ownerDocument;
    const next = nextSource ?? `<!doctype html>\n${doc.documentElement.outerHTML}`;
    latestHtmlRef.current = next;
    setDirty(true);
    setStatus("Editing");
    setHistory((previous) => [...previous.slice(0, historyIndex + 1), next].slice(-80));
    setHistoryIndex((index) => Math.min(index + 1, 79));
    syncElements();
  }, [historyIndex, syncElements]);

  commitRef.current = commit;

  const loadHtml = useCallback((html: string, name?: string, handle?: FileHandleLike) => {
    fileHandleRef.current = handle ?? null;
    setFileName(name || "Untitled page");
    latestHtmlRef.current = html;
    setSource(html);
    setHistory([html]);
    setHistoryIndex(0);
    setSelected(null);
    setDirty(false);
    setStatus("Ready");
  }, []);

  const openFile = async () => {
    const picker = (window as Window & { showOpenFilePicker?: (options?: object) => Promise<FileHandleLike[]> }).showOpenFilePicker;
    if (picker) {
      try {
        const [handle] = await picker({ types: [{ description: "HTML files", accept: { "text/html": [".html", ".htm"] } }] });
        const file = await (handle as FileHandleLike & { getFile: () => Promise<File> }).getFile();
        loadHtml(await file.text(), handle.name, handle);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setStatus("Opening file picker…");
        inputRef.current?.click();
      }
      return;
    }
    inputRef.current?.click();
  };

  const onFallbackFile = async (file?: File) => {
    if (file) loadHtml(await file.text(), file.name);
    if (inputRef.current) inputRef.current.value = "";
  };

  const exportHtml = useCallback(() => {
    const body = siteRef.current;
    if (!body) return latestHtmlRef.current;
    const documentElement = body.ownerDocument.documentElement.cloneNode(true) as HTMLElement;
    documentElement.querySelector("body")?.classList.remove("ve-editor-body");
    const html = `<!doctype html>\n${documentElement.outerHTML}`;
    latestHtmlRef.current = html;
    return html;
  }, []);

  const save = async () => {
    if (editing) return setStatus("Finish editing first");
    const html = exportHtml();
    const handle = fileHandleRef.current;
    if (handle?.createWritable) {
      try {
        const writable = await handle.createWritable();
        await writable.write(html);
        await writable.close();
        setDirty(false);
        setStatus("Saved to file");
        return;
      } catch {
        setStatus("Save failed — downloading instead");
      }
    }
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName === "Untitled page" ? "edited-page.html" : fileName;
    link.click();
    URL.revokeObjectURL(link.href);
    setDirty(false);
    setStatus("Downloaded — choose Open to edit it again");
  };

  const restore = (index: number) => {
    if (index < 0 || index >= history.length) return;
    latestHtmlRef.current = history[index];
    setSource(history[index]);
    setHistoryIndex(index);
    setSelected(null);
    setDirty(index !== 0);
    setStatus(index === 0 ? "Ready" : "Restored");
  };

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    const onLoad = () => {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      const body = doc.body;
      siteRef.current = body;
      body.classList.add("ve-editor-body");
      syncElements();
      body.addEventListener("click", (event) => {
        if (modeRef.current !== "design") return;
        const target = (event.target as Element).closest<EditorElement>("*");
        if (!target || target === body || target.tagName === "STYLE" || target.tagName === "SCRIPT") return;
        event.preventDefault();
        event.stopPropagation();
        setSelected(target);
        setTab("style");
      }, true);
      body.addEventListener("dblclick", (event) => {
        if (modeRef.current !== "design") return;
        const target = (event.target as Element).closest<EditorElement>("*");
        if (!target || target.children.length || ["IMG", "VIDEO", "INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) return;
        event.preventDefault();
        event.stopPropagation();
        target.contentEditable = "true";
        target.focus();
        setEditing(true);
        const finish = () => {
          target.contentEditable = "false";
          target.removeEventListener("blur", finish);
          setEditing(false);
          commitRef.current();
        };
        target.addEventListener("blur", finish);
      }, true);
    };
    frame.addEventListener("load", onLoad);
    frame.srcdoc = source;
    return () => frame.removeEventListener("load", onLoad);
  }, [source, syncElements]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "s") { event.preventDefault(); void save(); }
      if (event.key.toLowerCase() === "z") { event.preventDefault(); restore(event.shiftKey ? historyIndex + 1 : historyIndex - 1); }
      if (event.key.toLowerCase() === "y") { event.preventDefault(); restore(historyIndex + 1); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const updateStyle = (property: string, value: string) => {
    if (!selected) return;
    selected.style.setProperty(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), value);
    commit();
  };

  const addElement = (type: string) => {
    const body = siteRef.current;
    if (!body) return;
    const doc = body.ownerDocument;
    if (type === "image") return imageInputRef.current?.click();
    if (type === "video") return videoInputRef.current?.click();
    if (type === "document") return documentInputRef.current?.click();
    let element: HTMLElement;
    if (type === "dropdown") {
      element = doc.createElement("details");
      element.innerHTML = "<summary>New dropdown</summary><p>Double-click this text to edit.</p>";
    } else if (type === "divider") {
      element = doc.createElement("hr");
    } else {
      element = type === "section" ? doc.createElement("section") : doc.createElement(type === "heading" ? "h2" : type === "text" ? "p" : "button");
      element.textContent = type === "section" ? "New section — double-click to edit" : type === "heading" ? "New heading" : type === "text" ? "New text — double-click to edit" : "New button";
      if (type === "section") element.style.padding = "40px";
      if (type === "button") element.style.padding = "10px 18px";
    }
    body.appendChild(element);
    setSelected(element as EditorElement);
    commit();
  };

  const addAsset = (file: File, type: "image" | "video" | "document") => {
    const body = siteRef.current;
    if (!body) return;
    const url = URL.createObjectURL(file);
    const doc = body.ownerDocument;
    let element: HTMLElement;
    if (type === "image") {
      const image = doc.createElement("img"); image.src = url; image.alt = file.name; image.style.maxWidth = "100%"; element = image;
    } else if (type === "video") {
      const video = doc.createElement("video"); video.controls = true; video.src = url; video.style.maxWidth = "100%"; video.style.width = "100%"; element = video;
    } else {
      const wrapper = doc.createElement("div"); wrapper.className = "editor-document";
      const link = doc.createElement("a"); link.href = url; link.download = file.name; link.target = "_blank"; link.textContent = `Open / download ${file.name}`; wrapper.appendChild(link); element = wrapper;
    }
    body.appendChild(element); setSelected(element as EditorElement); commit(); setStatus(`${type[0].toUpperCase() + type.slice(1)} added`);
  };

  const handleAssets = (event: React.ChangeEvent<HTMLInputElement>, type: "image" | "video" | "document") => {
    Array.from(event.target.files || []).forEach((file) => addAsset(file, type));
    event.target.value = "";
  };

  const fields = useMemo(() => [["Width", "width"], ["Height", "height"], ["Margin", "margin"], ["Padding", "padding"], ["Font size", "fontSize"], ["Color", "color"], ["Background", "backgroundColor"], ["Border radius", "borderRadius"]] as const, []);

  return <div className="editor-app">
    <header className="editor-topbar"><div className="editor-brand"><span>⚡</span> Visual Website Editor <small>{dirty ? "Unsaved changes" : ""}</small></div><button onClick={openFile}><FolderOpen size={15} /> Open HTML</button><button disabled={historyIndex === 0} onClick={() => restore(historyIndex - 1)} title="Undo"><Undo2 size={15} /></button><button disabled={historyIndex >= history.length - 1} onClick={() => restore(historyIndex + 1)} title="Redo"><Redo2 size={15} /></button><button className="primary" onClick={() => void save()}><Save size={15} /> Save file</button><span className="editor-status">{status}</span><div className="editor-spacer" /><div className="view-toggle"><button className={mode === "design" ? "active" : ""} onClick={() => setMode("design")}>Design</button><button className={mode === "preview" ? "active" : ""} onClick={() => { setMode("preview"); setSelected(null); }}>Preview</button></div><span className="file-name"><FileCode2 size={14} /> {fileName}</span></header>
    <div className="editor-layout"><aside className="editor-panel left-panel"><h3>Add</h3><div className="add-grid">{[["section", "＋ Section"], ["heading", "＋ Heading"], ["text", "＋ Text"], ["button", "＋ Button"], ["dropdown", "＋ Dropdown"], ["image", "＋ Image"], ["video", "＋ Video"], ["document", "＋ Document"], ["divider", "＋ Divider"]].map(([type, label]) => <button key={type} onClick={() => addElement(type)}>{label}</button>)}</div><h3>Assets</h3><div className="asset-actions"><button onClick={() => imageInputRef.current?.click()}>Add Images</button><button onClick={() => documentInputRef.current?.click()}>Add Documents</button><button onClick={() => videoInputRef.current?.click()}>Add Videos</button></div><h3>Elements</h3><div className="element-tree">{elements.map((element, index) => <button className={selected === element ? "selected" : ""} key={`${element.tagName}-${index}`} onClick={() => setSelected(element)}>{elementLabel(element)}</button>)}</div><div className="asset-note"><strong>Persistent editing</strong><p>Open an HTML file, make changes, then use Save file. Chromium browsers write back to the original file; other browsers download an edited copy.</p><button onClick={() => void save()}><Download size={14} /> Export copy</button></div></aside><main className="editor-canvas"><div className="website-frame"><iframe ref={iframeRef} title="Website canvas" /></div></main><aside className="editor-panel right-panel"><div className="property-tabs"><button className={tab === "style" ? "active" : ""} onClick={() => setTab("style")}>Style</button><button className={tab === "content" ? "active" : ""} onClick={() => setTab("content")}>Content</button></div>{!selected ? <p className="empty-properties">Select an element to edit its properties.</p> : tab === "style" ? <div>{fields.map(([label, property]) => <label className="property-field" key={property}>{label}<input value={selected.style[property] || ""} onChange={(event) => updateStyle(property, event.target.value)} placeholder="inherit" /></label>)}<label className="property-field">ID<input value={selected.id} onChange={(event) => { selected.id = event.target.value; syncElements(); }} /></label><button className="delete-button" onClick={() => { selected.remove(); setSelected(null); commit(); }}><Trash2 size={14} /> Delete element</button></div> : <div>{!selected.children.length && <label className="property-field">Text<textarea value={selected.textContent || ""} onChange={(event) => { selected.textContent = event.target.value; commit(); }} /></label>}{selected.tagName === "IMG" && <><label className="property-field">Image source<input value={selected.getAttribute("src") || ""} onChange={(event) => { selected.setAttribute("src", event.target.value); commit(); }} /></label><label className="property-field">Alt text<input value={selected.getAttribute("alt") || ""} onChange={(event) => { selected.setAttribute("alt", event.target.value); commit(); }} /></label></>}</div>}</aside></div><input ref={inputRef} type="file" accept=".html,.htm,text/html" hidden onChange={(event) => void onFallbackFile(event.target.files?.[0])} /><input ref={imageInputRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(event) => handleAssets(event, "image")} /><input ref={documentInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.rtf,.odt,.ods,.odp" multiple hidden onChange={(event) => handleAssets(event, "document")} /><input ref={videoInputRef} type="file" accept="video/*,.mp4,.webm,.ogg" multiple hidden onChange={(event) => handleAssets(event, "video")} /></div>;
}
