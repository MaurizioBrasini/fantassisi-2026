/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Intestazioni di sicurezza su tutte le pagine: niente pagine dentro frame di altri siti
  // (clickjacking su pannello admin e voto), niente "indovinare" il tipo dei file, e il link
  // personale con il token non viene mai passato come referrer ad altri siti.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
}

module.exports = nextConfig