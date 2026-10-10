"use client";

import { MapPin, Phone, Clock, ExternalLink } from "lucide-react";

export default function LayananInformasi({
  title = "Layanan Informasi",
  addressTitle = "Alamat",
  address = "Jln. TGH. Jamaluddin Bagik Nyaka Santri, Aikmel, Lombok Timur, NTB.",
  phoneTitle = "Telepon/WhatsApp",
  phone = "(+62) 877 2024 2025",
  jamTitle = "Jam Pelayanan Offline",
  jam = "Sabtu - Kamis : 08.00 - 12.00 WITA",
  mapSrc = "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d1972.6191284475178!2d116.54021900000001!3d-8.573075!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2dcc35cff864eeb3%3A0x3b3faa6132c49ded!2sPondok%20Pesantren%20Assunnah%20lombok!5e0!3m2!1sid!2ssg!4v1759373752363!5m2!1sid!2ssg",
}) {
  return (
    <section id="kontak" className="spmb-section spmb-contact-section">
      <div className="spmb-container">
        <div className="spmb-cta-layout">
          <div>
            <p className="spmb-eyebrow">Hubungi Kami</p>
            <h2 className="spmb-display-title">{title}</h2>
            <p className="spmb-section-copy">Jika ada yang ingin ditanyakan, silakan hubungi kami</p>
          </div>
          <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="spmb-button spmb-button-green">
            <Phone aria-hidden="true" size={18} />Hubungi via WhatsApp<ExternalLink aria-hidden="true" size={16} />
          </a>
        </div>
        <div className="spmb-contact-details">
          <div><MapPin aria-hidden="true" /><h3>{addressTitle}</h3><p>{address}</p></div>
          <div><Phone aria-hidden="true" /><h3>{phoneTitle}</h3><a href={`tel:+${phone.replace(/\D/g, "")}`}>{phone}</a></div>
          <div><Clock aria-hidden="true" /><h3>{jamTitle}</h3><p>{jam}</p></div>
        </div>
        <div className="spmb-map-frame">
          <iframe src={mapSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen title="Lokasi Pondok Pesantren Assunnah" />
          <span className="spmb-map-label"><MapPin aria-hidden="true" size={18} />Lokasi Kami</span>
        </div>
        <a href="https://maps.google.com/?q=Pondok+Pesantren+Assunnah+lombok" target="_blank" rel="noreferrer" className="spmb-map-link">
          <MapPin aria-hidden="true" size={18} />Buka di Google Maps<ExternalLink aria-hidden="true" size={16} />
        </a>
      </div>
    </section>
  );
}
