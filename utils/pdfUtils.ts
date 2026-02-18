
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { CollectionCall, DiagnosticLab } from '../types';

/**
 * Generates a diagnostic bill PDF for a patient.
 */
export const generateBillPDF = (call: CollectionCall, lab: DiagnosticLab) => {
  const doc = new jsPDF() as any;

  // Header Colors & Branding
  const brandPurple = '#5F259F';
  const brandGreen = '#29A643';

  // Lab Logo & Title
  doc.setFillColor(brandPurple);
  doc.rect(0, 0, 210, 45, 'F');
  
  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('DISHA DIAGNOSTICS', 20, 18);
  
  doc.setFontSize(12);
  doc.text(lab.name.toUpperCase(), 20, 26);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const labAddressLines = doc.splitTextToSize(lab.location.address, 170);
  doc.text(labAddressLines, 20, 33);

  // Bill Meta Info
  doc.setTextColor('#000000');
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE / BILL', 20, 60);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Bill ID:`, 140, 60);
  doc.setFont('helvetica', 'normal');
  doc.text(`${call.id}`, 165, 60);

  doc.setFont('helvetica', 'bold');
  doc.text(`Date:`, 140, 65);
  doc.setFont('helvetica', 'normal');
  doc.text(`${new Date(call.placedAt).toLocaleDateString()}`, 165, 65);

  // Patient Info Section
  doc.setDrawColor(240, 240, 240);
  doc.line(20, 73, 190, 73);

  doc.setFont('helvetica', 'bold');
  doc.text('PATIENT DETAILS', 20, 83);
  
  doc.setFontSize(11);
  doc.text(call.patientName, 20, 90);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Mobile: ${call.patientPhone}`, 20, 96);
  
  const addressLines = doc.splitTextToSize(call.destination.address, 70);
  doc.text('Collection Address:', 110, 83);
  doc.setFontSize(9);
  doc.text(addressLines, 110, 90);

  // Service Table
  const tableData = call.billing.tests.map((test, index) => [
    index + 1,
    test.name,
    test.category,
    `INR ${test.price.toFixed(2)}`
  ]);

  doc.autoTable({
    startY: 110,
    head: [['#', 'Diagnostic Test', 'Category', 'Price']],
    body: tableData,
    headStyles: { fillColor: brandPurple, textColor: '#FFFFFF', fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 20, right: 20 },
    theme: 'grid'
  });

  const finalY = (doc as any).lastAutoTable.finalY || 150;

  // Aggregate Calculation
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Subtotal:', 140, finalY + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(`INR ${call.billing.subTotal.toFixed(2)}`, 170, finalY + 15);

  doc.setFont('helvetica', 'bold');
  doc.text('Visit Charge:', 140, finalY + 22);
  doc.setFont('helvetica', 'normal');
  doc.text(`INR ${call.billing.collectionCharge.toFixed(2)}`, 170, finalY + 22);

  doc.setFontSize(14);
  doc.setTextColor(brandPurple);
  doc.setFont('helvetica', 'bold');
  doc.text('GRAND TOTAL:', 130, finalY + 32);
  doc.text(`INR ${call.billing.totalAmount.toFixed(2)}`, 170, finalY + 32);

  // Payment Status
  doc.setFontSize(10);
  doc.setTextColor('#000000');
  doc.text('Payment Status:', 20, finalY + 15);
  if (call.billing.paymentStatus === 'PAID') {
    doc.setTextColor(brandGreen);
    doc.setFont('helvetica', 'bold');
    doc.text(`PAID VIA ${call.billing.paymentMode}`, 50, finalY + 15);
  } else {
    doc.setTextColor('#FF0000');
    doc.setFont('helvetica', 'bold');
    doc.text('PENDING', 50, finalY + 15);
  }

  // Footer / Notes
  doc.setDrawColor(240, 240, 240);
  doc.line(20, finalY + 45, 190, finalY + 45);
  
  doc.setFontSize(8);
  doc.setTextColor('#999999');
  doc.setFont('helvetica', 'normal');
  doc.text('Notes: Reports will be dispatched via WhatsApp/Email within the estimated TAT. This is a computer-generated bill.', 20, finalY + 52);
  doc.text(`Issued by: ${lab.name}. Contact support: care@dishalab.com`, 20, finalY + 57);

  doc.save(`Disha_Bill_${call.patientName.replace(/\s+/g, '_')}_${call.id}.pdf`);
};
