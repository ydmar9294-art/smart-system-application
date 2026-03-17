/**
 * Bluetooth Print Service
 * 
 * Provides a unified print interface:
 * - Web/Capacitor WebView: Falls back to iframe-based printing (printService.ts)
 * - Native Bluetooth: Ready for Capacitor Bluetooth plugin integration
 * 
 * The actual Bluetooth plugin must be installed in Android Studio.
 * This service provides the formatting and connection abstraction.
 */

import { formatInvoiceEscPos, escPosToBytes } from './escposFormatter';
import { logger } from './logger';

export type PrintFormat = 'a4' | 'pos';
export type PrinterConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'printing' | 'error';

interface PrinterDevice {
  name: string;
  address: string;
}

let connectionStatus: PrinterConnectionStatus = 'disconnected';
let connectedDevice: PrinterDevice | null = null;

/**
 * Check if native Bluetooth printing is available
 */
export function isBluetoothPrintAvailable(): boolean {
  // Will be true when native plugin is installed
  return false; // Placeholder — enable when Capacitor BT plugin is available
}

/**
 * Get current printer connection status
 */
export function getPrinterStatus(): { status: PrinterConnectionStatus; device: PrinterDevice | null } {
  return { status: connectionStatus, device: connectedDevice };
}

/**
 * Scan for Bluetooth printers (stub — needs native plugin)
 */
export async function scanForPrinters(): Promise<PrinterDevice[]> {
  logger.info('[BTPrint] Scanning for printers...', 'BluetoothPrint');
  // When native plugin is installed:
  // const devices = await BluetoothSerial.list();
  // return devices.map(d => ({ name: d.name, address: d.address }));
  return [];
}

/**
 * Connect to a Bluetooth printer (stub — needs native plugin)
 */
export async function connectPrinter(address: string): Promise<boolean> {
  logger.info(`[BTPrint] Connecting to ${address}...`, 'BluetoothPrint');
  connectionStatus = 'connecting';
  // When native plugin is installed:
  // await BluetoothSerial.connect({ address });
  // connectionStatus = 'connected';
  // connectedDevice = { name: 'Printer', address };
  // return true;
  connectionStatus = 'error';
  return false;
}

/**
 * Print invoice via Bluetooth (stub — needs native plugin)
 */
export async function printViaBluetoothRaw(data: Uint8Array): Promise<boolean> {
  if (connectionStatus !== 'connected') {
    logger.warn('[BTPrint] Not connected to printer', 'BluetoothPrint');
    return false;
  }
  connectionStatus = 'printing';
  try {
    // When native plugin is installed:
    // await BluetoothSerial.write({ data: Array.from(data) });
    logger.info('[BTPrint] Print sent successfully', 'BluetoothPrint');
    connectionStatus = 'connected';
    return true;
  } catch (err) {
    logger.warn('[BTPrint] Print failed', 'BluetoothPrint');
    connectionStatus = 'error';
    return false;
  }
}

/**
 * High-level: Print an invoice object to POS printer
 */
export async function printInvoicePOS(invoiceData: Parameters<typeof formatInvoiceEscPos>[0], paperWidth: 58 | 80 = 58): Promise<boolean> {
  const escPosStr = formatInvoiceEscPos(invoiceData, paperWidth);
  const bytes = escPosToBytes(escPosStr);
  return printViaBluetoothRaw(bytes);
}

/**
 * Disconnect printer
 */
export async function disconnectPrinter(): Promise<void> {
  // When native plugin is installed:
  // await BluetoothSerial.disconnect();
  connectionStatus = 'disconnected';
  connectedDevice = null;
}
