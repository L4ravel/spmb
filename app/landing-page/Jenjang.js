"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, X } from "lucide-react";
import { PROGRAMS } from "./programs";

function ProgramDialog({ program, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, []);

  return createPortal(
    <dialog ref={dialogRef} className="spmb-public spmb-program-dialog"
      aria-labelledby="spmb-program-title" aria-describedby="spmb-program-description"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}>
      <div className="spmb-dialog-heading">
        <div>
          <p className="spmb-eyebrow">Informasi Program</p>
          <h2 id="spmb-program-title">{program.label}</h2>
        </div>
        <button type="button" className="spmb-dialog-close" aria-label="Tutup informasi program" onClick={onClose}><X size={22} /></button>
      </div>
      <div className="spmb-dialog-content">
        <p id="spmb-program-description">{program.description}</p>
        <ul className="spmb-program-info-list">
          {program.options.map((option) => (
            <li key={option.label}>
              <h3>{option.label}</h3>
              <p>{option.description}</p>
            </li>
          ))}
        </ul>
        {program.note && <p className="spmb-program-info-note">{program.note}</p>}
      </div>
    </dialog>, document.body,
  );
}

export default function Jenjang() {
  const [selected, setSelected] = useState(null);
  return (
    <div className="spmb-catalogue">
      <div className="spmb-catalogue-heading">
        <p className="spmb-eyebrow">Pilihan Program</p>
        <h2>Jenjang Pendidikan</h2>
        <p>Pilih jenjang pendidikan untuk melihat informasi program.</p>
      </div>
      <div className="spmb-catalogue-grid">
        {PROGRAMS.map((program, index) => (
          <button key={program.id} type="button" className="spmb-level-card" aria-haspopup="dialog"
            onClick={() => setSelected(program)}>
            <span className="spmb-level-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <h3>{program.label}</h3>
            <p>{program.description}</p>
            <span className="spmb-level-arrow" aria-hidden="true"><ChevronRight size={22} /></span>
          </button>
        ))}
      </div>
      {selected && <ProgramDialog program={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
