"use client";

import { useAuth } from "@/components/AuthProvider";
import { useEffect, useState } from "react";
import { db, storage } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Navbar from "@/components/Navbar";
import { FolderOpen, Upload, FileText, Image, File, X, Download } from "lucide-react";
import toast from "react-hot-toast";

export default function VaultPage() {
  const { user } = useAuth();
  const [familyGroup, setFamilyGroup] = useState(null);
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    const q = query(
      collection(db, "familyGroups"),
      where("members", "array-contains", user.uid)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const group = { id: snap.docs[0].id, ...snap.docs[0].data() };
    setFamilyGroup(group);

    const dQ = query(
      collection(db, "documents"),
      where("familyGroupId", "==", group.id)
    );
    const dSnap = await getDocs(dQ);
    setDocs(
      dSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    );
  }

  async function handleUpload(file) {
    if (!file || !familyGroup) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Max 10MB.");
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(
        storage,
        `vaults/${familyGroup.id}/${Date.now()}_${file.name}`
      );
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const docRef = await addDoc(collection(db, "documents"), {
        name: file.name,
        url,
        type: file.type,
        size: file.size,
        familyGroupId: familyGroup.id,
        uploadedBy: user.uid,
        uploadedAt: new Date().toISOString(),
      });

      setDocs([
        {
          id: docRef.id,
          name: file.name,
          url,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        },
        ...docs,
      ]);
      toast.success("Document uploaded!");
    } catch (err) {
      console.error(err);
      toast.error("Upload failed. Please try again.");
    }
    setUploading(false);
  }

  function handleFileInput(e) {
    const file = e.target.files[0];
    if (file) handleUpload(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function getFileIcon(type) {
    if (type?.startsWith("image/")) return <Image className="w-5 h-5 text-violet-500" />;
    if (type?.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
    return <File className="w-5 h-5 text-slate-500" />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Document Vault</h1>
            <p className="text-slate-500 mt-1">
              Insurance cards, medical records, and emergency info.
            </p>
          </div>
          <label className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors cursor-pointer shadow-sm shadow-rose-200">
            <Upload className="w-4 h-4" />
            {uploading ? "Uploading..." : "Upload"}
            <input type="file" className="hidden" onChange={handleFileInput} />
          </label>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-8 mb-6 text-center transition-all ${
            dragOver
              ? "border-rose-400 bg-rose-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
            <FolderOpen className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">
            Drag and drop files here
          </p>
          <p className="text-xs text-slate-400 mt-1">or click the Upload button above</p>
          <p className="text-xs text-slate-400 mt-0.5">Max file size: 10MB</p>
        </div>

        {/* Documents List */}
        <div className="space-y-3">
          {docs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                No documents yet
              </h3>
              <p className="text-slate-500">
                Upload insurance cards, medication lists, or ID cards.
              </p>
            </div>
          ) : (
            docs.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:border-rose-200 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-rose-50 transition-colors">
                    {getFileIcon(doc.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{doc.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatSize(doc.size || 0)} ·{" "}
                      {new Date(doc.uploadedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700"
                    title="Open file"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
                {doc.type?.startsWith("image/") && (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={doc.url}
                      alt={doc.name}
                      className="mt-3 rounded-lg border border-slate-100 max-h-48 object-cover w-full"
                      loading="lazy"
                    />
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
