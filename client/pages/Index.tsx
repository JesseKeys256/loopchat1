import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileCode2, FolderOpen, Redo2, Save, Trash2, Undo2 } from "lucide-react";

type ElementNode = HTMLElement;

const starter = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New website</title><style>body{font-family:Arial,sans-serif;margin:0;color:#17251e}main{max-width:900px;margin:auto;padding:80px 32px}h1{font-size:48px;margin:0 0 16px}p{font-size:18px;line-height:1.6;color:#526159}.cta{display:inline-block;background:#2e7658;color:#fff;padding:12px 20px;border-radius:7px}</style></head><body><main><h1>Build something great</h1><p>Open an HTML file to start editing, or use this starter page.</p><a class="cta" href="#">Get started</a></main></body></html>`;

const kebab = (value: string) => value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const labelFor = (element: Element) => {
  const text = (element.textContent || element.getAttribute("alt") || "").replace(/\s+/g, " ").trim();
  return `<${element.tagName.toLowerCase()}>${text ? ` ${text.slice(0, 28)}${text.length > 28 ? "…" : ""}` : ""}`;
};

export default function Index() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const htmlInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<Document | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const historyRef = useRef<string[]>([starter]);
  const historyIndexRef = useRef(0);
  const snapshotTimerRef = useRef<number | undefined>(undefined);
  const [source, setSource] = useState(starter);
  const [fileName, setFileName] = useState("new-website.html");
  const [selected, setSelected] = useState<ElementNode | null>(null);
  const [nodes, setNodes] = useState<ElementNode[]>([]);
  const [tab, setTab] = useState<"style" | "content">("style");
  const [mode, setMode] = useState<"design" | "preview">("design");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [historyVersion, setHistoryVersion] = useState(0);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const serialize = useCallback(() => {
    const doc = documentRef.current;
    if (!doc?.documentElement) return source;
    const root = doc.documentElement.cloneNode(true) as HTMLElement;
    root.querySelector("body")?.classList.remove("visual-editor-document");
    return `<!doctype html>\n${root.outerHTML}`;
  }, [source]);

  const refreshNodes = useCallback(() => {
    const body = documentRef.current?.body;
    if (!body) return;
    setNodes(Array.from(body.querySelectorAll<ElementNode>("*:not(style):not(script)")));
  }, []);

  const record = useCallback(() => {
    const html = serialize();
    const history = historyRef.current.slice(0, historyIndexRef.current + 1);
    if (history[history.length - 1] === html) return;
    history.push(html);
    historyRef.current = history.slice(-60);
    historyIndexRef.current = historyRef.current.length - 1;
    setHistoryVersion((value) => value + 1);
    setDirty(true);
    setStatus("Unsaved changes");
    refreshNodes();
  }, [refreshNodes, serialize]);

  const queueRecord = useCallback(() => {
    window.clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = window.setTimeout(record, 300);
  }, [record]);

  const load = useCallback((html: string, name: string) => {
    observerRef.current?.disconnect();
    documentRef.current = null;
    historyRef.current = [html];
    historyIndexRef.current = 0;
    setSource(html);
    setFileName(name);
    setSelected(null);
    setDirty(false);
    setStatus("Loaded");
    setHistoryVersion((value) => value + 1);
  }, []);

  const openHtml = () => htmlInputRef.current?.click();

  const saveCopy = useCallback(() => {
    if (selected?.isContentEditable) {
      setStatus("Finish editing before saving");
      return;
    }
    window.clearTimeout(snapshotTimerRef.current);
    const html = serialize();
    if (!html) return;
    const baseName = fileName.replace(/\.html?$/i, "") || "website";
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${baseName}-edited.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDirty(false);
    setStatus(`Saved ${anchor.download}`);
  }, [fileName, selected, serialize]);

  const undo = () => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    setSource(historyRef.current[historyIndexRef.current]);
    setSelected(null);
    setDirty(historyIndexRef.current > 0);
    setStatus("Undo");
    setHistoryVersion((value) => value + 1);
  };

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    setSource(historyRef.current[historyIndexRef.current]);
    setSelected(null);
    setDirty(true);
    setStatus("Redo");
    setHistoryVersion((value) => value + 1);
  };

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onLoad = () => {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      observerRef.current?.disconnect();
      documentRef.current = doc;
      doc.body.classList.add("visual-editor-document");
      refreshNodes();
      const observer = new MutationObserver(() => {
        setDirty(true);
        setStatus("Unsaved changes");
        refreshNodes();
        queueRecord();
      });
      observer.observe(doc.body, { subtree: true, childList: true, attributes: true, characterData: true });
      observerRef.current = observer;
      doc.body.addEventListener("click", (event) => {
        if (modeRef.current !== "design") {
          window.setTimeout(() => {
            setDirty(true);
            setStatus("Unsaved changes");
            queueRecord();
          }, 0);
          return;
        }
        const target = (event.target as Element).closest<ElementNode>("*");
        if (!target || target === doc.body || ["STYLE", "SCRIPT"].includes(target.tagName)) return;
        event.preventDefault();
        event.stopPropagation();
        setSelected(target);
        setTab("style");
      }, true);
      doc.body.addEventListener("dblclick", (event) => {
        if (modeRef.current !== "design") return;
        const target = (event.target as Element).closest<ElementNode>("*");
        if (!target || target.children.length || ["IMG", "VIDEO", "INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) return;
        event.preventDefault();
        event.stopPropagation();
        target.contentEditable = "true";
        target.focus();
        setSelected(target);
        const finish = () => {
          target.contentEditable = "false";
          target.removeEventListener("blur", finish);
          record();
        };
        target.addEventListener("blur", finish);
      }, true);
    };
    frame.addEventListener("load", onLoad);
    frame.srcdoc = source;
    return () => {
      frame.removeEventListener("load", onLoad);
      observerRef.current?.disconnect();
    };
  }, [refreshNodes, record, queueRecord, source]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "s") { event.preventDefault(); saveCopy(); }
      if (event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if (event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });

  const update = (fn: () => void) => { fn(); setDirty(true); setStatus("Unsaved changes"); queueRecord(); };
  const add = (type: string) => {
    const body = documentRef.current?.body;
    if (!body) return;
    if (type === "image") return imageInputRef.current?.click();
    if (type === "video") return videoInputRef.current?.click();
    if (type === "document") return documentInputRef.current?.click();
    const doc = body.ownerDocument;
    const element = type === "section" ? doc.createElement("section") : type === "heading" ? doc.createElement("h2") : type === "text" ? doc.createElement("p") : type === "button" ? doc.createElement("button") : type === "dropdown" ? doc.createElement("details") : doc.createElement("hr");
    if (type === "dropdown") element.innerHTML = "<summary>New dropdown</summary><p>Double-click to edit this content.</p>";
    else if (type === "divider") { /* empty divider */ }
    else element.textContent = type === "section" ? "New section — double-click to edit" : type === "heading" ? "New heading" : type === "text" ? "New text — double-click to edit" : "New button";
    if (type === "section") element.style.padding = "40px";
    if (type === "button") element.style.padding = "10px 18px";
    body.appendChild(element);
    setSelected(element);
    record();
  };

  const addAsset = async (file: File, type: "image" | "video" | "document") => {
    const body = documentRef.current?.body;
    if (!body) return;
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
    const doc = body.ownerDocument;
    let element: HTMLElement;
    if (type === "image") { const image = doc.createElement("img"); image.src = data; image.alt = file.name; image.style.maxWidth = "100%"; element = image; }
    else if (type === "video") { const video = doc.createElement("video"); video.src = data; video.controls = true; video.style.maxWidth = "100%"; video.style.width = "100%"; element = video; }
    else { const wrapper = doc.createElement("div"); const link = doc.createElement("a"); link.href = data; link.download = file.name; link.textContent = `Open / download ${file.name}`; wrapper.appendChild(link); element = wrapper; }
    body.appendChild(element); setSelected(element); record(); setStatus(`${type} added — unsaved`);
  };

  const styles: [string, string][] = [["Width", "width"], ["Height", "height"], ["Margin", "margin"], ["Padding", "padding"], ["Font size", "fontSize"], ["Color", "color"], ["Background", "backgroundColor"], ["Border radius", "borderRadius"]];
  return <div className="editor-app"><header className="editor-topbar"><div className="editor-brand"><span>⚡</span> Visual Website Editor {dirty && <small>Unsaved</small>}</div><button onClick={openHtml}><FolderOpen size={15} /> Open HTML</button><button onClick={undo} disabled={historyIndexRef.current === 0}><Undo2 size={15} /></button><button onClick={redo} disabled={historyIndexRef.current >= historyRef.current.length - 1}><Redo2 size={15} /></button><button className="primary" onClick={saveCopy}><Save size={15} /> Save new copy</button><span className="editor-status">{status}</span><div className="editor-spacer" /><div className="view-toggle"><button className={mode === "design" ? "active" : ""} onClick={() => setMode("design")}>Design</button><button className={mode === "preview" ? "active" : ""} onClick={() => { setMode("preview"); setSelected(null); }}>Preview</button></div><span className="file-name"><FileCode2 size={14} /> {fileName}</span></header><div className="editor-layout"><aside className="editor-panel left-panel"><h3>Add</h3><div className="add-grid">{[["section", "＋ Section"], ["heading", "＋ Heading"], ["text", "＋ Text"], ["button", "＋ Button"], ["dropdown", "＋ Dropdown"], ["image", "＋ Image"], ["video", "＋ Video"], ["document", "＋ Document"], ["divider", "＋ Divider"]].map(([type, text]) => <button key={type} onClick={() => add(type)}>{text}</button>)}</div><h3>Assets</h3><div className="asset-actions"><button onClick={() => imageInputRef.current?.click()}>Add Images</button><button onClick={() => documentInputRef.current?.click()}>Add Documents</button><button onClick={() => videoInputRef.current?.click()}>Add Videos</button></div><h3>Elements</h3><div className="element-tree">{nodes.map((node, index) => <button className={selected === node ? "selected" : ""} key={`${node.tagName}-${index}`} onClick={() => setSelected(node)}>{labelFor(node)}</button>)}</div><div className="save-note"><strong>Save a complete copy</strong><p>Every current edit and added asset is embedded into the new HTML file.</p><button onClick={saveCopy}><Download size={14} /> Export copy</button></div></aside><main className="editor-canvas"><div className="website-frame"><iframe ref={frameRef} title="Website canvas" /></div></main><aside className="editor-panel right-panel"><div className="property-tabs"><button className={tab === "style" ? "active" : ""} onClick={() => setTab("style")}>Style</button><button className={tab === "content" ? "active" : ""} onClick={() => setTab("content")}>Content</button></div>{!selected ? <p className="empty-properties">Select an element to edit its properties.</p> : tab === "style" ? <div>{styles.map(([name, property]) => <label className="property-field" key={property}>{name}<input value={selected.style[property as keyof CSSStyleDeclaration] as string || ""} onChange={(event) => update(() => selected.style.setProperty(kebab(property), event.target.value))} /></label>)}<label className="property-field">ID<input value={selected.id} onChange={(event) => update(() => { selected.id = event.target.value; })} /></label><label className="property-field">Classes<input value={selected.className} onChange={(event) => update(() => { selected.className = event.target.value; })} /></label><button className="delete-button" onClick={() => { selected.remove(); setSelected(null); record(); }}><Trash2 size={14} /> Delete element</button></div> : <div>{!selected.children.length && <label className="property-field">Text<textarea value={selected.textContent || ""} onChange={(event) => update(() => { selected.textContent = event.target.value; })} /></label>}{selected.tagName === "A" && <label className="property-field">Link URL<input value={selected.getAttribute("href") || ""} onChange={(event) => update(() => selected.setAttribute("href", event.target.value))} /></label>}{selected.tagName === "IMG" && <label className="property-field">Alt text<input value={(selected as HTMLImageElement).alt} onChange={(event) => update(() => { (selected as HTMLImageElement).alt = event.target.value; })} /></label>}</div>}</aside></div><input ref={htmlInputRef} type="file" accept=".html,.htm,text/html" hidden onChange={async (event) => { const file = event.target.files?.[0]; if (file) load(await file.text(), file.name); event.target.value = ""; }} /><input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={(event) => { Array.from(event.target.files || []).forEach((file) => void addAsset(file, "image")); event.target.value = ""; }} /><input ref={videoInputRef} type="file" accept="video/*" multiple hidden onChange={(event) => { Array.from(event.target.files || []).forEach((file) => void addAsset(file, "video")); event.target.value = ""; }} /><input ref={documentInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.rtf,.odt,.ods,.odp" multiple hidden onChange={(event) => { Array.from(event.target.files || []).forEach((file) => void addAsset(file, "document")); event.target.value = ""; }} /></div>;
}
