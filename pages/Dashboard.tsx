
import React, { useState, useEffect, useRef } from 'react';
// Fix: added @ts-ignore to suppress type errors for Link import
// @ts-ignore
import { Link } from 'react-router-dom';
import { LayoutDashboard, CheckCircle, Clock, XCircle, Loader2, Star, Download, QrCode, X, Users, BookOpen, Zap } from 'lucide-react';
// Fix: remove .ts extensions from local imports
import { Registration, RegistrationStatus } from '../types';
import { supabase } from '../supabase';
import html2canvas from 'html2canvas';

const PassModal: React.FC<{ registration: Registration; onClose: () => void }> = ({ registration, onClose }) => {
  const passRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [qrBlobUrl, setQrBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchQrAsBlob = async () => {
      try {
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&bgcolor=000&color=FFD700&data=${encodeURIComponent(JSON.stringify({ id: registration.id, type: 'ELIXIR_ENTRY' }))}`;
        const response = await fetch(url);
        const blob = await response.blob();
        setQrBlobUrl(URL.createObjectURL(blob));
      } catch (err) {
        console.error("QR Blob fetch failed", err);
      }
    };
    fetchQrAsBlob();
  }, [registration.id]);

  const handleDownload = async () => {
    if (!passRef.current || !qrBlobUrl) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(passRef.current, { backgroundColor: '#000000', scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `ELIXIR_PASS_${registration.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      alert("Download failed. Please take a screenshot.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative max-w-sm w-full animate-in zoom-in-95 duration-500">
        <button onClick={onClose} className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white"><X size={32} /></button>
        <div ref={passRef} className="relative bg-black border-2 border-gold/40 rounded-[3rem] p-10 shadow-2xl overflow-hidden">
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-full flex justify-between items-start mb-10">
               <div><p className="text-[10px] text-gold font-black uppercase tracking-[0.4em] mb-1">Entry Pass</p><h4 className="text-2xl font-cinzel font-black text-white glow-text-gold tracking-widest">ELIXIR'26</h4></div>
               <Star className="text-gold" fill="currentColor" size={28} />
            </div>
            <div className="bg-white p-5 rounded-[2.5rem] mb-10 border-4 border-gold/30 shadow-2xl w-full flex items-center justify-center">
               {qrBlobUrl ? <img src={qrBlobUrl} alt="Pass QR" className="w-full h-auto" /> : <Loader2 className="animate-spin text-gold" />}
            </div>
            <div className="w-full text-left space-y-6 mb-8">
               <div><p className="text-[10px] text-gray-600 font-bold uppercase mb-1">Leader</p><p className="text-xl font-cinzel font-bold text-white uppercase">{registration.name}</p></div>
               <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                 <div><p className="text-[10px] text-gray-600 font-bold uppercase mb-1">ID</p><p className="text-gold font-mono font-bold">{registration.id}</p></div>
                 <div><p className="text-[10px] text-gray-600 font-bold uppercase mb-1">Venue</p><p className="text-white font-bold text-[10px] uppercase">GCE Erode</p></div>
               </div>
            </div>
            <button onClick={handleDownload} disabled={downloading || !qrBlobUrl} className="w-full bg-gold text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-amber-500 glow-gold flex items-center justify-center gap-2">
              {downloading ? <Loader2 className="animate-spin" /> : <Download size={20}/>} Download Pass
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [userRegistrations, setUserRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPass, setSelectedPass] = useState<Registration | null>(null);
  const userEmail = localStorage.getItem('elixir_user_email');

  useEffect(() => {
    const fetchUserRegistrations = async () => {
      if (!userEmail) { setLoading(false); return; }
      const { data } = await supabase.from('registrations').select('*').eq('email', userEmail.toLowerCase()).order('timestamp', { ascending: false });
      if (data) setUserRegistrations(data);
      setLoading(false);
    };
    fetchUserRegistrations();
  }, [userEmail]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]"><Loader2 className="animate-spin text-gold" size={48} /></div>;

  return (
    <div className="py-24 bg-[#0A0A0A] min-h-screen">
      {selectedPass && <PassModal registration={selectedPass} onClose={() => setSelectedPass(null)} />}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-cinzel font-bold tracking-widest uppercase mb-12">My Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {userRegistrations.map(reg => (
            <div key={reg.id} className="bg-[#111] rounded-[2.5rem] border border-white/10 p-8 shadow-2xl">
              <div className="mb-6"><h4 className="text-2xl font-cinzel font-bold text-white mb-2 uppercase">{reg.name}</h4><p className="text-gold text-[10px] font-black uppercase tracking-[0.2em]">{reg.department}</p></div>
              <div className="mb-10"><div className="flex flex-wrap gap-2">{reg.events.map((ev, i) => <span key={i} className="bg-gold/5 text-gold text-[10px] font-bold uppercase px-3 py-1 rounded-lg border border-gold/10">{ev}</span>)}</div></div>
              <button onClick={() => reg.status !== RegistrationStatus.PENDING && setSelectedPass(reg)} className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold uppercase tracking-widest ${reg.status !== RegistrationStatus.PENDING ? 'bg-gold text-black glow-gold' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`} disabled={reg.status === RegistrationStatus.PENDING}>
                <QrCode size={18} /> {reg.status === RegistrationStatus.PENDING ? 'Awaiting Verification' : 'View Pass'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;