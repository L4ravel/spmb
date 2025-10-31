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
  

  // Full Akses
  "user@admin.com": [ "*"  
  ], 
  "usmanirawan00@gmail.com": ["*"],  
  "hisyam.salafy@gmail.com": ["*"],
  "abdurrahman.man.88@gmail.com": ["*"],  
  "wirasandilalu12@gmail.com": ["*"],
  

   

};

// Fallback kalau email tidak terdaftar:
export const DEFAULT_ALLOWED = ["*"];
