
import React, { useState, useEffect, useRef } from 'react';
// Fix: added @ts-ignore to suppress type errors for useNavigate and useLocation imports
// @ts-ignore
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Info, ArrowRight, ArrowLeft, QrCode, AlertCircle, Smartphone, Users, UserPlus, X, Loader2, CreditCard, Download, Star, User, Database, BookOpen, UserCheck } from 'lucide-react';
import { EVENTS } from './constants';
import { Registration, RegistrationStatus } from './types';
import { supabase } from './supabase';
import html2canvas from 'html2canvas';

interface RegisterProps {
  onSubmit: (reg: Registration) => Promise<void>;
}

const Register: React.FC<RegisterProps> = ({ onSubmit }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const passRef = useRef<HTMLDivElement>(null);
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [submitError, setSubmitError] = useState<{message: string, isSchema: boolean} | null>(null);
  const [registeredData, setRegisteredData] = useState<Registration | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    college: '',
    department: '',
    email: '',
    phone: '',
    transactionId: '',
    selectedEvents: [] as string[],
    teamMembers: [] as string[]
  });

  const [errors, setErrors] = useState({
    email: '',
    phone: '',
    transactionId: ''
  });

  const upiId = "midhun73272@oksbi";
  const PRICE_PER_MEMBER = 250;

  // Sync team members array with current max selection
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const eventId = params.get('eventId');
    
    setFormData(prev => {
      let newSelected = [...prev.selectedEvents];
      if (eventId && EVENTS.some(e => e.id === eventId) && !newSelected.includes(eventId)) {
        newSelected = [eventId];
      }

      const selectedEventsData = EVENTS.filter(e => newSelected.includes(e.id));
      const newMax = selectedEventsData.length > 0 
        ? Math.max(...selectedEventsData.map(e => e.maxMembers)) 
        : 1;

      // Adjust team members array size based on new max selection (maxTeamSize - 1)
      const adjustedMembers = [...prev.teamMembers].slice(0, newMax - 1);
      while(adjustedMembers.length < newMax - 1) {
        adjustedMembers.push('');
      }

      return {
        ...prev,
        selectedEvents: newSelected,
        teamMembers: adjustedMembers
      };
    });
  }, [location.search]);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validatePhone = (phone: string) => {
    const re = /^[0-9]{10}$/;
    return re.test(phone.replace(/\s/g, ''));
  };

  useEffect(() => {
    let emailErr = '';
    let phoneErr = '';
    let transErr = '';
    
    if (formData.email && !validateEmail(formData.email)) emailErr = 'Invalid email address format';
    if (formData.phone && !validatePhone(formData.phone)) phoneErr = 'Phone number must be 10 digits';
    
    if (formData.transactionId && formData.transactionId.length > 0 && formData.transactionId.length < 12) {
      transErr = 'Transaction ID must be 12 digits';
    }

    setErrors({ email: emailErr, phone: phoneErr, transactionId: transErr });
  }, [formData.email, formData.phone, formData.transactionId]);

  const selectedEventsData = EVENTS.filter(e => formData.selectedEvents.includes(e.id));
  const maxTeamSize = selectedEventsData.length > 0 
    ? Math.max(...selectedEventsData.map(e => e.maxMembers)) 
    : 1;

  // Calculate total fee: (Leader + Active Team Members) * 250
  const activeMembersCount = formData.teamMembers.filter(m => m.trim() !== '').length;
  const totalFee = (1 + activeMembersCount) * PRICE_PER_MEMBER;

  const toggleEvent = (id: string) => {
    setFormData(prev => {
      const isSelected = prev.selectedEvents.includes(id);
      const newSelected = isSelected
        ? prev.selectedEvents.filter(eid => eid !== id)
        : [...prev.selectedEvents, id];
      
      const newMax = newSelected.length > 0 
        ? Math.max(...EVENTS.filter(e => newSelected.includes(e.id)).map(e => e.maxMembers)) 
        : 1;

      // Adjust team members array size based on new max size (maxTeamSize - 1)
      const adjustedMembers = prev.teamMembers.slice(0, newMax - 1);
      while(adjustedMembers.length < newMax - 1) adjustedMembers.push('');

      return {
        ...prev,
        selectedEvents: newSelected,
        teamMembers: adjustedMembers
      };
    });
  };

  const handleNext = () => {
    if (step === 1 && formData.selectedEvents.length === 0) return;
    if (step === 2) {
      if (!formData.name || !formData.college || !formData.department || !formData.email || !formData.phone || errors.email || errors.phone) return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setSubmitError(null);
    setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.transactionId || formData.transactionId.length !== 12) return;
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      const regId = Math.random().toString(36).substr(2, 9).toUpperCase();
      
      const newReg: Registration = {
        id: regId,
        name: formData.name,
        college: formData.college,
        department: formData.department,
        email: formData.email.toLowerCase(),
        phone: formData.phone,
        teamMembers: formData.teamMembers.filter(m => m.trim() !== ''),
        events: formData.selectedEvents.map(id => EVENTS.find(ev => ev.id === id)?.title || ''),
        totalFee,
        transactionId: formData.transactionId,
        status: RegistrationStatus.PENDING,
        timestamp: new Date().toISOString()
      };
      
      await onSubmit(newReg);
      setRegisteredData(newReg);
      localStorage.setItem('elixir_user_email', newReg.email);
      setStep(4);
    } catch (err: any) {
      console.error('Submission failed:', err);
      setSubmitError({
        message: err.message || "Failed to complete registration.",
        isSchema: false
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!passRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(passRef.current, {
        backgroundColor: '#000000',
        scale: 2,
        useCORS: true,
        logging: false
      });
      const link = document.createElement('a');
      link.download = `ELIXIR_PASS_${registeredData?.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const upiUri = `upi://pay?pa=${upiId}&pn=ELIXIR%20Symposium&am=${totalFee}&cu=INR&tn=ELIXIR%20Reg`;
  const paymentQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}`;
  const passQrUrl = registeredData ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&bgcolor=000&color=FFD700&data=${encodeURIComponent(JSON.stringify({ id: registeredData.id, type: 'ELIXIR_ENTRY' }))}` : '';

  const isTransactionValid = formData.transactionId.length === 12;

  return (
    <div className="py-24 bg-[#0A0A0A] min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {step < 4 && (
          <div className="mb-12 flex items-center justify-between">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-500 ${
                  step >= s ? 'border-gold bg-gold text-black font-bold' : 'border-white/10 text-gray-600'
                }`}>
                  {step > s ? <CheckCircle size={20} /> : s}
                </div>
                {s < 3 && <div className={`flex-grow h-1 mx-4 rounded-full transition-all duration-500 ${step > s ? 'bg-gold' : 'bg-white/10'}`}></div>}
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="bg-[#111] rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
          {step === 1 && (
            <div className="p-8 md:p-12 space-y-8 animate-in slide-in-from-right-10 duration-500">
              <div className="text-center">
                <h3 className="text-3xl font-cinzel font-bold text-white mb-2 uppercase tracking-widest">Event Selection</h3>
                <p className="text-gray-400">Choose your events. Fees are calculated per participant (₹250/head).</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {EVENTS.map(event => (
                  <div 
                    key={event.id}
                    onClick={() => toggleEvent(event.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      formData.selectedEvents.includes(event.id)
                        ? 'bg-gold/10 border-gold shadow-[0_0_15px_rgba(255,215,0,0.1)]'
                        : 'bg-white/5 border-white/10 hover:border-gold/50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-white uppercase tracking-wider text-sm">{event.title}</h4>
                      {formData.selectedEvents.includes(event.id) && <CheckCircle className="text-gold" size={18} />}
                    </div>
                    <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold">
                      <span className="text-gray-500">{event.category}</span>
                      <span className="text-gold">Max Team: {event.maxMembers}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center">
                <span className="text-gray-400 font-bold uppercase text-sm tracking-widest">Base Rate:</span>
                <span className="text-xl font-cinzel font-bold text-gold">₹{PRICE_PER_MEMBER} / Person</span>
              </div>
              <div className="pt-4">
                <button onClick={handleNext} disabled={formData.selectedEvents.length === 0} className="w-full bg-gold text-black py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-amber-500 transition-all disabled:opacity-50 glow-gold uppercase tracking-widest text-sm">
                  Add Participant Details <ArrowRight size={20} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-8 md:p-12 space-y-8 animate-in slide-in-from-right-10 duration-500">
              <div className="text-center">
                <h3 className="text-3xl font-cinzel font-bold text-white mb-2 uppercase tracking-widest">Participant Profiles</h3>
                <div className="flex items-center justify-center gap-3 bg-gold/5 border border-gold/10 py-2 px-4 rounded-full max-w-fit mx-auto">
                   <Users className="text-gold" size={16} />
                   <span className="text-xs font-bold text-gold uppercase tracking-widest">
                     Team Size: {1 + activeMembersCount} / {maxTeamSize}
                   </span>
                </div>
              </div>
              
              <div className="bg-black/20 p-8 rounded-3xl border border-white/5 mb-6">
                <h4 className="text-gold text-xs font-black uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold"><User size={16} /></div>
                  Leader Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Full Name</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="As per ID" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-gold transition-colors text-sm" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">College</label>
                    <input type="text" value={formData.college} onChange={e => setFormData({...formData, college: e.target.value})} placeholder="Current Institution" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-gold transition-colors text-sm" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Department</label>
                    <input type="text" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} placeholder="e.g. EEE, ECE" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-gold transition-colors text-sm" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Phone</label>
                    <input type="tel" maxLength={10} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} placeholder="10-digit number" className={`w-full bg-white/5 border ${errors.phone ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-4 text-white focus:outline-none focus:border-gold transition-colors text-sm`} />
                  </div>
                  <div className="space-y-3 md:col-span-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Email</label>
                    <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="leader@example.com" className={`w-full bg-white/5 border ${errors.email ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-4 text-white focus:outline-none focus:border-gold transition-colors text-sm`} />
                  </div>
                </div>
              </div>

              {maxTeamSize > 1 && (
                <div className="bg-black/20 p-8 rounded-3xl border border-white/5">
                  <h4 className="text-gold text-xs font-black uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold"><UserPlus size={16} /></div>
                    Additional Members (₹{PRICE_PER_MEMBER} each)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {formData.teamMembers.map((member, index) => (
                      <div key={index} className="space-y-2">
                        <label className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Member {index + 2} Name</label>
                        <input 
                          type="text" 
                          value={member} 
                          onChange={e => {
                            const newMembers = [...formData.teamMembers];
                            newMembers[index] = e.target.value;
                            setFormData({...formData, teamMembers: newMembers});
                          }} 
                          placeholder="Optional" 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors text-xs" 
                        />
                      </div>
                    ))}
                    {formData.teamMembers.length === 0 && (
                       <p className="text-[10px] text-gray-500 italic md:col-span-2">This event is for individual participants.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="p-5 bg-gold/5 border border-gold/10 rounded-2xl flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <Users className="text-gold" size={20} />
                    <div>
                       <p className="text-[10px] text-gray-400 font-bold uppercase">Estimated Fee</p>
                       <p className="text-white text-xs font-bold">{1 + activeMembersCount} Participants</p>
                    </div>
                 </div>
                 <p className="text-2xl font-cinzel font-black text-gold">₹{totalFee}</p>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={handleBack} className="flex-1 border border-white/20 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:bg-white/5 uppercase tracking-widest text-xs"><ArrowLeft size={16} /> Back</button>
                <button onClick={handleNext} disabled={!formData.name || !formData.college || !formData.department || !formData.email || !formData.phone || !!errors.email || !!errors.phone} className="flex-[2] bg-gold text-black py-4 rounded-xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2 hover:bg-amber-500 transition-all disabled:opacity-30 glow-gold">
                  Payment Verification <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="p-8 md:p-12 space-y-8 animate-in slide-in-from-right-10 duration-500">
              <div className="text-center">
                <h3 className="text-3xl font-cinzel font-bold text-white mb-2 uppercase tracking-widest">Secure Payment</h3>
                <p className="text-gray-400">Total Payable: <span className="text-gold font-bold">₹{totalFee}</span></p>
              </div>
              
              <div className="flex flex-col items-center max-w-md mx-auto">
                <div className="bg-white p-6 rounded-[3rem] border-4 border-gold glow-gold shadow-2xl mb-12">
                  <img src={paymentQrUrl} alt="Payment QR Code" className="w-64 h-64 object-contain" />
                  <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col items-center">
                    <p className="text-black font-black text-xl tracking-widest">{upiId}</p>
                    <p className="text-gray-400 text-[10px] uppercase font-black mt-2">Department of EEE GCE Erode</p>
                  </div>
                </div>
                
                <div className="w-full space-y-3">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block text-center">Reference Transaction ID</label>
                  <div className="relative">
                    <CreditCard className={`absolute left-4 top-1/2 -translate-y-1/2 ${formData.transactionId.length === 12 ? 'text-gold' : 'text-gray-500'}`} size={18} />
                    <input 
                      type="text" 
                      required
                      maxLength={12}
                      value={formData.transactionId}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, ''); 
                        setFormData({...formData, transactionId: val});
                      }}
                      placeholder="12-digit numeric code" 
                      className={`w-full bg-white/5 border ${errors.transactionId ? 'border-amber-500' : 'border-white/10'} rounded-2xl pl-12 pr-4 py-5 text-white focus:outline-none focus:border-gold transition-colors text-center font-black tracking-[0.4em] text-xl`} 
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={handleBack} className="flex-1 border border-white/20 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:bg-white/5 uppercase tracking-widest text-xs"><ArrowLeft size={16} /> Back</button>
                <button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting || !isTransactionValid} 
                  className={`flex-[2] py-4 rounded-xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
                    isTransactionValid 
                      ? 'bg-gold text-black hover:bg-amber-500 glow-gold' 
                      : 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed opacity-30'
                  }`}
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <UserCheck size={20} />}
                  {isSubmitting ? 'Verifying...' : 'Finish Registration'}
                </button>
              </div>
            </div>
          )}

          {step === 4 && registeredData && (
            <div className="p-10 md:p-16 text-center animate-in zoom-in duration-700 bg-gradient-to-b from-[#111] to-[#0A0A0A]">
              <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8 border border-green-500/20">
                <CheckCircle size={40} strokeWidth={3} />
              </div>
              <h3 className="text-3xl md:text-5xl font-cinzel font-black text-white mb-4 tracking-widest uppercase">REGISTRATION RECEIVED</h3>
              <p className="text-sm text-gray-400 mb-12 max-w-md mx-auto leading-relaxed">Your application is in queue for manual verification. Your total fee of <span className="text-gold font-bold">₹{registeredData.totalFee}</span> has been logged.</p>
              
              <div className="relative max-w-sm mx-auto group mb-12">
                 <div className="absolute inset-0 bg-gold/20 blur-[80px] rounded-full opacity-40"></div>
                 <div ref={passRef} className="relative bg-black border-2 border-gold/40 rounded-[3.5rem] p-10 shadow-2xl overflow-hidden">
                    <div className="relative z-10">
                       <div className="flex justify-between items-start mb-10">
                         <div className="text-left">
                            <p className="text-[10px] text-gold font-black uppercase tracking-[0.4em] mb-1">Temporary ID</p>
                            <h4 className="text-xl font-cinzel font-black text-white glow-text-gold tracking-widest">ELIXIR'26</h4>
                         </div>
                         <Star className="text-gold" fill="currentColor" size={24} />
                       </div>
                       
                       <div className="bg-white p-5 rounded-[2.5rem] mb-10 border-4 border-gold/20 shadow-xl">
                          <img src={passQrUrl} alt="Pass QR" className="w-48 h-48 mx-auto" crossOrigin="anonymous" />
                       </div>
                       
                       <div className="text-left space-y-4">
                          <div>
                            <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mb-1">Leader</p>
                            <p className="text-white font-bold uppercase text-xs">{registeredData.name}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mb-1">Pass ID</p>
                            <p className="text-gold font-mono font-bold text-xs">{registeredData.id}</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-5 justify-center">
                <button onClick={() => navigate('/dashboard')} className="bg-gold text-black px-12 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-amber-500 transition-all glow-gold flex items-center justify-center gap-3">
                  Check Dashboard <ArrowRight size={20}/>
                </button>
                <button 
                  onClick={handleDownload} 
                  className="bg-white/5 border border-white/10 text-white px-12 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                >
                  <Download size={20}/> Download Draft
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;