import React, { useState, useEffect } from 'react';
import { format, isBefore, startOfDay, addDays, isToday, parse } from 'date-fns';
import { Calendar, Clock, X, Check } from 'lucide-react';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'framer-motion';

const SlotBookingSystem = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingDetails, setBookingDetails] = useState({ name: '', mobileNumber: '', duration: 1, members: 1 });
  const [bookingHistory, setBookingHistory] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTVMode, setIsTVMode] = useState(false);
  const [promoCodes, setPromoCodes] = useState([]);
  const [newPromo, setNewPromo] = useState({ code: '', discount: 0 });
  const [error, setError] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [activeTab, setActiveTab] = useState('select-slot');

  useEffect(() => {
    fetchSlots();
    loadLocalData();
  }, [currentDate]);

  const fetchSlots = async () => {
    const response = await fetch(`/api/slots?date=${format(currentDate, 'yyyy-MM-dd')}`);
    const data = await response.json();
    setSlots(data);
  };

  const loadLocalData = () => {
    const savedHistory = JSON.parse(localStorage.getItem('bookingHistory') || '[]');
    const savedPromos = JSON.parse(localStorage.getItem('promoCodes') || '[]');
    setBookingHistory(savedHistory);
    setPromoCodes(savedPromos);
  };

  const generateSlots = () => {
    const slots = [];
    const today = startOfDay(new Date());
    if (isBefore(currentDate, today)) return slots; // No past dates
    const startHour = isToday(currentDate) ? Math.ceil(new Date().getHours() + (new Date().getMinutes() > 10 ? 1 : 0)) : 5;
    for (let hour = startHour; hour < 24; hour++) {
      slots.push({ id: `${format(currentDate, 'yyyy-MM-dd')}-${hour}`, startTime: hour, isBooked: false });
    }
    return slots;
  };

  const handleSlotClick = (slot) => {
    if (slot.isBooked) return;
    setSelectedSlot(slot);
    setActiveTab('enter-details');
  };

  const handleBooking = async () => {
    const endTime = selectedSlot.startTime + bookingDetails.duration;
    if (endTime > 24) {
      setError(`Buddy Box closes at midnight. Max hours available: ${24 - selectedSlot.startTime} hr${24 - selectedSlot.startTime > 1 ? 's' : ''}.`);
      setShowPopup(true);
      return;
    }

    const updatedSlot = { ...selectedSlot, isBooked: true, bookingDetails };
    await fetch('/api/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSlot),
    });

    const newHistory = [...bookingHistory, { ...bookingDetails, slot: selectedSlot, date: currentDate, transactionNumber: Date.now() }];
    localStorage.setItem('bookingHistory', JSON.stringify(newHistory));
    setBookingHistory(newHistory);
    setSelectedSlot(null);
    setBookingDetails({ name: '', mobileNumber: '', duration: 1, members: 1 });
    setActiveTab('select-slot');
    fetchSlots();
  };

  const handleMarkHoliday = async (date, title) => {
    const response = await fetch('/api/holiday', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: format(date, 'yyyy-MM-dd'), title }),
    });
    fetchSlots();
  };

  const addPromoCode = () => {
    const updatedPromos = [...promoCodes, newPromo];
    localStorage.setItem('promoCodes', JSON.stringify(updatedPromos));
    setPromoCodes(updatedPromos);
    setNewPromo({ code: '', discount: 0 });
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {isTVMode ? (
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          <h1 className="text-7xl font-bold text-orange-500 animate-glow">Buddy Box</h1>
          <div className="grid grid-cols-2 gap-4 mt-8">
            {slots.filter(s => s.isBooked).map(slot => (
              <div key={slot.id} className="p-4 bg-blue-500 text-white rounded">
                <p>{slot.bookingDetails.name}</p>
                <p>{`${slot.startTime}:00 - ${slot.startTime + slot.bookingDetails.duration}:00`}</p>
              </div>
            ))}
          </div>
        </motion.div>
      ) : (
        <>
          <h1 className="text-3xl sm:text-5xl font-bold text-center mb-4">Buddy Box</h1>
          <p className="text-center text-sm mb-4">The Cricket Turf</p>
          <p className="text-center mb-4">{format(new Date(), 'h:mm a')}</p>

          <div className="tabs flex justify-center mb-4">
            <button
              className={`px-4 py-2 ${activeTab === 'select-slot' ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}
              onClick={() => setActiveTab('select-slot')}
            >
              Select Slot
            </button>
            <button
              className={`px-4 py-2 ${activeTab === 'enter-details' ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}
              onClick={() => setActiveTab('enter-details')}
            >
              Enter Details
            </button>
          </div>

          {activeTab === 'select-slot' && (
            <div>
              <div className="flex justify-between mb-4">
                <button onClick={() => setCurrentDate(addDays(currentDate, -1))} disabled={isBefore(currentDate, startOfDay(new Date()))}>
                  Previous
                </button>
                <p>{format(currentDate, 'MMMM d, yyyy')}</p>
                <button onClick={() => setCurrentDate(addDays(currentDate, 1))}>Next</button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map(slot => (
                  <button
                    key={slot.id}
                    className={`p-2 rounded ${slot.isBooked ? 'bg-blue-500 text-white' : slot.isHoliday ? 'bg-red-500 text-white' : selectedSlot?.id === slot.id ? 'bg-orange-300' : 'bg-gray-200'}`}
                    onClick={() => handleSlotClick(slot)}
                    disabled={slot.isBooked || slot.isHoliday}
                  >
                    {`${slot.startTime}:00 - ${slot.startTime + 1}:00`}
                    {slot.isHoliday && <p>{slot.holidayTitle}</p>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'enter-details' && selectedSlot && (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Name"
                value={bookingDetails.name}
                onChange={e => setBookingDetails({ ...bookingDetails, name: e.target.value })}
                className="w-full p-2 border rounded"
              />
              <input
                type="tel"
                placeholder="Mobile Number"
                value={bookingDetails.mobileNumber}
                onChange={e => setBookingDetails({ ...bookingDetails, mobileNumber: e.target.value })}
                className="w-full p-2 border rounded"
              />
              <input
                type="number"
                placeholder="Duration (hours)"
                value={bookingDetails.duration}
                min="1"
                onChange={e => setBookingDetails({ ...bookingDetails, duration: parseInt(e.target.value) })}
                className="w-full p-2 border rounded"
              />
              <input
                type="number"
                placeholder="Members"
                value={bookingDetails.members}
                min="1"
                onChange={e => setBookingDetails({ ...bookingDetails, members: parseInt(e.target.value) })}
                className="w-full p-2 border rounded"
              />
              <button onClick={handleBooking} className="w-full p-2 bg-orange-500 text-white rounded">
                Book Slot
              </button>
            </div>
          )}

          <AnimatePresence>
            {showPopup && (
              <motion.div
                className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="bg-white p-6 rounded shadow-lg text-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <p className="mb-4">{error}</p>
                  <button
                    onClick={() => setShowPopup(false)}
                    className="px-4 py-2 bg-orange-500 text-white rounded"
                  >
                    Close
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {isAdmin && (
            <div className="mt-8">
              <h2 className="text-xl font-bold">Admin Panel</h2>
              <input
                type="text"
                placeholder="Holiday Title"
                onChange={e => handleMarkHoliday(currentDate, e.target.value)}
                className="w-full p-2 border rounded mb-2"
              />
              <h3 className="text-lg">Promo Codes</h3>
              <input
                type="text"
                placeholder="Promo Code"
                value={newPromo.code}
                onChange={e => setNewPromo({ ...newPromo, code: e.target.value })}
                className="w-full p-2 border rounded mb-2"
              />
              <input
                type="number"
                placeholder="Discount (%)"
                value={newPromo.discount}
                onChange={e => setNewPromo({ ...newPromo, discount: parseInt(e.target.value) })}
                className="w-full p-2 border rounded mb-2"
              />
              <button onClick={addPromoCode} className="w-full p-2 bg-orange-500 text-white rounded">
                Add Promo Code
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SlotBookingSystem;