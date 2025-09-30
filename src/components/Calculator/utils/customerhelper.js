export const formatPhoneNumber = (phone) => {
    if (!phone) return 'N/A';
    // Remove all non-digit characters and any leading 1 or +1
    const digits = phone.replace(/\D/g, '').replace(/^1/, '');
    if (digits.length !== 10) return phone; // Fallback if not exactly 10 digits
    const areaCode = digits.slice(0, 3);
    const firstPart = digits.slice(3, 6);
    const secondPart = digits.slice(6, 10);
    return `+1 (${areaCode}) ${firstPart}-${secondPart}`;
  };
  
  export const formatDate = (date) =>
    date
      ? date.toLocaleDateString('en-US', {
          month: 'numeric',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
        })
      : 'N/A';