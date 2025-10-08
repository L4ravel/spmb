// components/ppdb/LayananInformasi.js
"use client";

 import {
   MapPin,
   Phone,
   Clock,
  MessageCircle,
   ExternalLink
 } from "lucide-react";

export default function LayananInformasi({
  title = "Layanan Informasi",
  addressTitle = "Alamat",
  address = "Jln. TGH. Jamaluddin Bagik Nyaka Santri, Aikmel, Lombok Timur, NTB.",
  phoneTitle = "Telepon/WhatsApp",
  phone = "(+62) 878 5777 1623",
  jamTitle = "Jam Pelayanan Offline",
  jam = "Sabtu - Kamis : 08.00 - 12.00 WITA",
  mapSrc = "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d1972.6191284475178!2d116.54021900000001!3d-8.573075!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2dcc35cff864eeb3%3A0x3b3faa6132c49ded!2sPondok%20Pesantren%20Assunnah%20lombok!5e0!3m2!1sid!2ssg!4v1759373752363!5m2!1sid!2ssg",
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-white py-16 md:py-24">
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-200/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-indigo-200/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 md:px-6">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2">
            <MessageCircle className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-bold uppercase tracking-wider text-violet-700">
              Hubungi Kami
            </span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 md:text-5xl">
            {title}
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Jika ada yang ingin ditanyakan, silakan hubungi kami
          </p>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-10">
          {/* MAP */}
          <div className="lg:col-span-7">
            <div className="group relative">
              {/* Decorative frame */}
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-violet-200/50 to-indigo-200/50 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
              
              <div className="relative overflow-hidden rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-slate-200/50">
                <div className="overflow-hidden rounded-xl ring-1 ring-violet-100">
                  <div className="relative w-full" style={{ paddingTop: "62%" }}>
                    <iframe
                      className="absolute inset-0 h-full w-full transition-all duration-500 grayscale-[40%] group-hover:grayscale-0"
                      src={mapSrc}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                      title="Lokasi Pondok Pesantren Assunnah"
                    />
                  </div>
                </div>

                {/* Map overlay badge */}
                <div className="absolute left-6 top-6 rounded-xl bg-white/95 px-4 py-2 shadow-lg backdrop-blur-sm ring-1 ring-violet-100">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-violet-600" />
                    <span className="text-sm font-bold text-slate-900">Lokasi Kami</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Directions link */}
            <a
              href="https://maps.google.com/?q=Pondok+Pesantren+Assunnah+lombok"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-3 font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
            >
              <MapPin className="h-5 w-5" />
              Buka di Google Maps
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {/* INFO */}
          <div className="lg:col-span-5">
            <div className="space-y-4">
              <InfoCard
                icon={<MapPin className="h-6 w-6" />}
                title={addressTitle}
                desc={address}
                color="from-blue-500 to-cyan-500"
              />
              <InfoCard
                icon={<Phone className="h-6 w-6" />}
                title={phoneTitle}
                desc={phone}
                asLink={`https://wa.me/${phone.replace(/\D/g, "")}`}
                color="from-green-500 to-emerald-500"
                linkText="Hubungi via WhatsApp"
              />
              <InfoCard
                icon={<Clock className="h-6 w-6" />}
                title={jamTitle}
                desc={jam}
                color="from-purple-500 to-violet-500"
              />
            </div>

          
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoCard({ icon, title, desc, asLink, color, linkText }) {
  const cardContent = (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:ring-violet-300">
      {/* Decorative gradient background */}
      <div className={`absolute right-0 top-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full bg-gradient-to-br ${color} opacity-10 blur-2xl transition-all duration-300 group-hover:scale-150 group-hover:opacity-20`} />

      <div className="relative flex items-start gap-4">
        {/* Icon */}
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
          <div className="text-white">{icon}</div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-slate-900">{title}</p>
          <p className="mt-2 break-words text-sm leading-relaxed text-slate-600">
            {desc}
          </p>
          
          {/* Link indicator */}
          {asLink && (
            <div className="mt-3 flex items-center gap-1 text-sm font-semibold text-violet-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <span>{linkText || "Klik untuk kontak"}</span>
              <ExternalLink className="h-4 w-4" />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (asLink) {
    return (
      <a
        href={asLink}
        target="_blank"
        rel="noreferrer"
        className="block"
      >
        {cardContent}
      </a>
    );
  }

  return cardContent;
}

function FeatureBox({ icon, title, desc, color }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-200/50 transition-all duration-300 hover:shadow-lg">
      <div className={`absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-gradient-to-br ${color} opacity-10 blur-xl transition-all duration-300 group-hover:scale-150`} />
      
      <div className="relative">
        <div className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-md transition-transform duration-300 group-hover:scale-110`}>
          <div className="text-white">{icon}</div>
        </div>
        <h4 className="mb-2 font-bold text-slate-900">{title}</h4>
        <p className="text-sm text-slate-600">{desc}</p>
      </div>
    </div>
  );
}