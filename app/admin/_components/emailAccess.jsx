// Email -> daftar route yang diizinkan.
// Pakai "*" untuk izinkan semua route admin.
// Edit DI SINI SAJA untuk atur akses per-email.
export const EMAIL_ACCESS = {
 "mzkyzakky@gmail.com": [ "/admin/pembayaran",], 
  "satria1satu@googlemail.com": [ "/admin/pembayaran",], 
  "riaruqoyyah@spmb.com": [ "/admin/pembayaran",], 
  "heniherawati@spmb.com": [ "/admin/pembayaran",],
  "zul@spmb.com": [ "/admin/pembayaran",], 
  "bahaudin@smpb.com": [ "/admin/pembayaran",],  
  "ekasastrawijaya@spmb.com": [ "/admin/nilai-tahfidz",],  
  "rahmah@spmb.com": [ "/admin/nilai-tahfidz",],  
  "zaenab@spmb.com": [ "/admin/nilai-tahfidz",],  
  "yulianti@spmb.com": [ "/admin/nilai-tahfidz",],  
  "syafii@spmb.com": [ "/admin/nilai-tahfidz",],  
  "abuhusna@spmb.com": [ "/admin/nilai-tahfidz",],  
  "abdulwahid@spmb.com": [ "/admin/nilai-tahfidz",], 
  "abdullahhusni@spmb.com": [ "/admin/kuota",],   
  "riaruqoyyah16@gmail.com": [ "/admin/tes-wawancara",],  
  "heniherawati530@gmail.com": [ "/admin/tes-wawancara",],  
  "rabiatuladwyh2612@gmail.com": [ "/admin/tes-wawancara",],    

  // Full Akses
  "user@admin.com": [ "*"  
  ], 
  "usmanirawan00@gmail.com": ["*"],  
  "hisyam.salafy@gmail.com": ["*"],
  "abdurrahman.man.88@gmail.com": ["*"],  
  "wirasandilalu12@gmail.com": ["*"],
  "amrizkaul@gmail.com": ["*"],

   
};

// Fallback kalau email tidak terdaftar:
export const DEFAULT_ALLOWED = ["*"];
