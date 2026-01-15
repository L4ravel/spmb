'use client';

import { useEffect, useMemo, useState } from 'react';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MapPin, TrendingUp, Users, Award, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('Failed load ' + path);
  return res.json();
}

export default function AdminGeografiPage() {
  const db = getFirestore(app);

  // master wilayah
  const [provinces, setProvinces] = useState([]);
  const [regencies, setRegencies] = useState([]);
  const [districtMap, setDistrictMap] = useState({});
  const [jenjangOptions, setJenjangOptions] = useState([]);

  // data ppdb
  const [ppdbData, setPpdbData] = useState([]);

  // filter
  const [jenjang, setJenjang] = useState('');
  const [viewMode, setViewMode] = useState('top10'); // top10, top20, all
  const [chartType, setChartType] = useState('bar'); // bar, pie

  useEffect(() => {
    loadJSON('/regions/provinces.json').then(setProvinces);
    loadJSON('/regions/52.regencies.json').then(setRegencies);

    Promise.all([
      '52.01','52.02','52.03','52.04','52.05','52.06','52.07','52.08','52.09','52.10'
    ].map(k =>
      loadJSON(`/regions/${k}.districts.json`).then(list =>
        list.forEach(d => {
          districtMap[d.code] = d.name;
        })
      )
    )).then(() => setDistrictMap({ ...districtMap }));
  }, []);

  useEffect(() => {
    getDocs(collection(db, 'ppdb')).then(snap => {
      const rows = [];
      const jenjangSet = new Set();

      snap.forEach(doc => {
        const data = doc.data();
        rows.push(data);
        if (data.jenjang) jenjangSet.add(data.jenjang);
      });

      setPpdbData(rows);
      setJenjangOptions(Array.from(jenjangSet).sort());
    });
  }, []);

  const provinceName = code =>
    provinces.find(p => p.code === code)?.name || code;

  const regencyName = code =>
    regencies.find(r => r.code === code)?.name || code;

  const districtName = code =>
    districtMap[code] || code;

  const tableData = useMemo(() => {
    const map = {};

    ppdbData.forEach(p => {
      if (jenjang && p.jenjang !== jenjang) return;

      const key = [
        p.jenjang,
        p.provinceCode,
        p.regencyCode,
        p.districtCode
      ].join('|');

      if (!map[key]) {
        map[key] = {
          jenjang: p.jenjang,
          provinceCode: p.provinceCode,
          regencyCode: p.regencyCode,
          districtCode: p.districtCode,
          total: 0
        };
      }
      map[key].total++;
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [ppdbData, jenjang]);

  const statsData = useMemo(() => {
  // TOTAL SISWA MENTAH PER JENJANG (AMAN)
  const totalPerJenjang = ppdbData.reduce((sum, p) => {
    if (jenjang && p.jenjang !== jenjang) return sum;
    return sum + 1;
  }, 0);

  const dataWithPercentage = tableData.map((row, index) => ({
    ...row,
    percentage:
      totalPerJenjang > 0
        ? (row.total / totalPerJenjang) * 100
        : 0,
    rank: index + 1,
    locationName: `${districtName(row.districtCode)}, ${regencyName(row.regencyCode)}`
  }));

  return {
    total: totalPerJenjang,
    data: dataWithPercentage
  };
}, [tableData, ppdbData, jenjang]);



  const displayData = useMemo(() => {
    if (viewMode === 'top10') return statsData.data.slice(0, 10);
    if (viewMode === 'top20') return statsData.data.slice(0, 20);
    return statsData.data;
  }, [statsData, viewMode]);

  const chartData = useMemo(() => {
    return displayData.map(item => ({
      name: item.locationName,
      value: item.total,
      percentage: item.percentage
    }));
  }, [displayData]);

  const COLORS = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
    '#06b6d4', '#6366f1', '#f97316', '#14b8a6', '#a855f7',
    '#ef4444', '#84cc16', '#22d3ee', '#fb923c', '#34d399',
    '#c084fc', '#fbbf24', '#60a5fa', '#818cf8', '#f472b6'
  ];

  // Function to export to Excel
  const handleExportExcel = () => {
    const exportData = displayData.map((r) => ({
  'Peringkat': r.rank,
  'Jenjang': r.jenjang,
  'Provinsi': provinceName(r.provinceCode),
  'Kabupaten': regencyName(r.regencyCode),
  'Kecamatan': districtName(r.districtCode),
  'Jumlah Siswa': r.total,
  // ANGKA DESIMAL (0.64 bukan "64%")
  'Persentase': r.percentage / 100
}));


    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const range = XLSX.utils.decode_range(worksheet['!ref']);
for (let R = 1; R <= range.e.r; R++) {
  const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: 6 })]; // kolom ke-7
  if (cell) cell.z = '0.00%';
}
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Geografis PPDB');

    // Set column widths
    worksheet['!cols'] = [
      { wch: 10 }, // Peringkat
      { wch: 12 }, // Jenjang
      { wch: 20 }, // Provinsi
      { wch: 25 }, // Kabupaten
      { wch: 25 }, // Kecamatan
      { wch: 15 }, // Jumlah Siswa
      { wch: 12 }  // Persentase
    ];

    const fileName = `Data_Geografis_PPDB_${jenjang || 'Semua'}_${viewMode}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 shadow-lg mb-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <MapPin className="w-8 h-8 text-white" />
                <h1 className="text-3xl font-bold text-white">
                  Dashboard Analitik Geografis PPDB
                </h1>
              </div>
              <p className="text-blue-100 text-sm">
                Visualisasi data pendaftaran siswa berdasarkan wilayah geografis
              </p>
            </div>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-lg"
            >
              <Download className="w-5 h-5" />
              Export Excel
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-6 space-y-6 pb-8">
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Siswa</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {statsData.total.toLocaleString('id-ID')}
                </p>
              </div>
              <Users className="w-12 h-12 text-blue-200 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Total Wilayah</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {statsData.data.length}
                </p>
              </div>
              <MapPin className="w-12 h-12 text-purple-200 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-pink-100 text-sm font-medium">Jenjang Aktif</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {jenjangOptions.length}
                </p>
              </div>
              <Award className="w-12 h-12 text-pink-200 opacity-80" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
          <div className="flex flex-wrap gap-4">
            {/* Jenjang Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter Jenjang
              </label>
              <select
                value={jenjang}
                onChange={e => setJenjang(e.target.value)}
                className="w-full bg-white text-gray-900 px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              >
                <option value="">Semua Jenjang</option>
                {jenjangOptions.map(j => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            </div>

            {/* View Mode Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tampilan Data
              </label>
              <select
                value={viewMode}
                onChange={e => setViewMode(e.target.value)}
                className="w-full bg-white text-gray-900 px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              >
                <option value="top10">Top 10 Wilayah</option>
                <option value="top20">Top 20 Wilayah</option>
                <option value="all">Semua Wilayah</option>
              </select>
            </div>

            {/* Chart Type Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipe Diagram
              </label>
              <select
                value={chartType}
                onChange={e => setChartType(e.target.value)}
                className="w-full bg-white text-gray-900 px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              >
                <option value="bar">Diagram Batang</option>
                <option value="pie">Diagram Lingkaran</option>
              </select>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-800">
              Visualisasi Data {viewMode === 'top10' ? 'Top 10' : viewMode === 'top20' ? 'Top 20' : 'Semua'} Wilayah
            </h2>
          </div>

          {chartType === 'bar' ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={120}
                  stroke="#6b7280"
                  tick={{ fill: '#374151', fontSize: 12 }}
                />
                <YAxis stroke="#6b7280" tick={{ fill: '#374151' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value, name) => {
                    if (name === 'value') return [value + ' siswa', 'Jumlah'];
                    return value;
                  }}
                />
                <Legend wrapperStyle={{ color: '#374151' }} />
                <Bar dataKey="value" fill="#3b82f6" name="Jumlah Siswa" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                  outerRadius={130}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value) => value + ' siswa'}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-500" />
              Peringkat Wilayah Berdasarkan Jumlah Siswa
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="p-4 text-left text-gray-700 font-semibold">Peringkat</th>
                  <th className="p-4 text-left text-gray-700 font-semibold">Jenjang</th>
                  <th className="p-4 text-left text-gray-700 font-semibold">Provinsi</th>
                  <th className="p-4 text-left text-gray-700 font-semibold">Kabupaten</th>
                  <th className="p-4 text-left text-gray-700 font-semibold">Kecamatan</th>
                  <th className="p-4 text-right text-gray-700 font-semibold">Jumlah</th>
                  <th className="p-4 text-right text-gray-700 font-semibold">Persentase</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-100 hover:bg-blue-50 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {r.rank <= 3 && (
                          <Award className={`w-5 h-5 ${
                            r.rank === 1 ? 'text-yellow-500' :
                            r.rank === 2 ? 'text-gray-400' :
                            'text-amber-600'
                          }`} />
                        )}
                        <span className={`font-semibold ${
                          r.rank <= 3 ? 'text-blue-600' : 'text-gray-700'
                        }`}>
                          #{r.rank}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-block bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-xs font-medium">
                        {r.jenjang}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700">{provinceName(r.provinceCode)}</td>
                    <td className="p-4 text-gray-700">{regencyName(r.regencyCode)}</td>
                    <td className="p-4 text-gray-700">{districtName(r.districtCode)}</td>
                    <td className="p-4 text-right">
                      <span className="font-bold text-gray-900 bg-blue-100 px-3 py-1 rounded-lg">
                        {r.total.toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(r.percentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-700 font-medium min-w-[60px]">
                          {r.percentage.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {displayData.length === 0 && (
            <div className="p-12 text-center">
              <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Tidak ada data untuk ditampilkan</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}