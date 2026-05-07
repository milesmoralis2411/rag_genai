"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, Send, Settings, CheckCircle2, FileText, Loader2 } from "lucide-react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [keys, setKeys] = useState({
    openaiKey: "",
    qdrantUrl: "",
    qdrantKey: ""
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("rag_keys");
    if (saved) {
      setKeys(JSON.parse(saved));
    } else {
      setShowSettings(true);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveKeys = () => {
    localStorage.setItem("rag_keys", JSON.stringify(keys));
    setShowSettings(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setUploading(true);
    setUploaded(false);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("openaiKey", keys.openaiKey);
    formData.append("qdrantUrl", keys.qdrantUrl);
    formData.append("qdrantKey", keys.qdrantKey);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        alert("Upload failed: " + (err.error || "Unknown error"));
      } else {
        setUploaded(true);
      }
    } catch (err) {
      alert("Error uploading document.");
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMsg,
          openaiKey: keys.openaiKey,
          qdrantUrl: keys.qdrantUrl,
          qdrantKey: keys.qdrantKey
        })
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages(prev => [...prev, { role: "assistant", content: "Error: " + (err.error || "Failed to get response.") }]);
        setLoading(false);
        return;
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Network error occurred." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen bg-black text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-white/10 bg-[#0a0a0a] flex flex-col p-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-semibold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            NotebookLM Clone
          </h1>
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Settings size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1">
          <div className="mb-4 text-sm text-gray-400 font-medium tracking-wider">SOURCES</div>
          
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 hover:border-blue-500 rounded-xl cursor-pointer bg-white/5 transition-all group">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {uploading ? (
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
              ) : (
                <Upload className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mb-2 transition-colors" />
              )}
              <p className="text-sm text-gray-400 font-medium">
                {uploading ? "Processing..." : "Upload PDF or TXT"}
              </p>
            </div>
            <input type="file" className="hidden" accept=".pdf,.txt" onChange={handleUpload} />
          </label>

          {file && (
            <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
              <FileText className="text-blue-400" size={24} />
              <div className="flex-1 truncate">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-gray-400">
                  {uploaded ? (
                    <span className="text-emerald-400 flex items-center gap-1 mt-1"><CheckCircle2 size={12}/> Indexed</span>
                  ) : "Processing..."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#050505]">
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
              <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/30">
                <FileText size={32} />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Chat with your Document</h2>
              <p className="text-gray-400">Upload a document on the left, then ask questions. The AI will answer based strictly on the document context.</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-4 rounded-2xl max-w-[80%] ${
                    m.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-white/10 text-gray-200 border border-white/10 rounded-bl-none'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="p-4 rounded-2xl bg-white/10 text-gray-400 border border-white/10 rounded-bl-none flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 bg-[#050505] border-t border-white/10">
          <form onSubmit={handleSend} className="max-w-3xl mx-auto relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask a question about your document..."
              className="w-full bg-white/10 border border-white/20 rounded-full px-6 py-4 pr-16 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              disabled={loading || !uploaded}
            />
            <button 
              type="submit" 
              disabled={loading || !uploaded || !input.trim()}
              className="absolute right-2 p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 disabled:text-gray-500 rounded-full transition-colors"
            >
              <Send size={18} />
            </button>
          </form>
          {!uploaded && messages.length === 0 && (
            <p className="text-center text-sm text-gray-500 mt-3">Please upload and index a document first to start chatting.</p>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold mb-6">Configuration</h2>
            <p className="text-sm text-gray-400 mb-6">Since this is a live deployment, please provide your own API keys. They are stored locally in your browser.</p>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">OpenAI API Key</label>
                <input 
                  type="password" 
                  value={keys.openaiKey} 
                  onChange={e => setKeys({...keys, openaiKey: e.target.value})}
                  className="w-full bg-black border border-white/20 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Qdrant Cluster URL</label>
                <input 
                  type="text" 
                  value={keys.qdrantUrl} 
                  onChange={e => setKeys({...keys, qdrantUrl: e.target.value})}
                  className="w-full bg-black border border-white/20 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://xyz.qdrant.tech"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Qdrant API Key</label>
                <input 
                  type="password" 
                  value={keys.qdrantKey} 
                  onChange={e => setKeys({...keys, qdrantKey: e.target.value})}
                  className="w-full bg-black border border-white/20 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional if local"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button 
                onClick={saveKeys}
                className="bg-white text-black px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
