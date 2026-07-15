interface Sample {
  timestamp: number;
  bytesSent: number;
}

const MAX_SAMPLES = 6;
const samplesByFile = new Map<string, Sample[]>();

export function recordProgress(fileId: string, bytesSent: number) {
  const samples = samplesByFile.get(fileId) || [];
  const last = samples[samples.length - 1];

  //   Skip ducplicate/backwards samples (can happen right after a retry  resets progress)

  if (last && bytesSent < last.bytesSent) {
    samplesByFile.set(fileId, [{ timestamp: Date.now(), bytesSent }]);
    return;
  }

  samples.push({ timestamp: Date.now(), bytesSent });
  if (samples.length > MAX_SAMPLES) samples.shift();
  samplesByFile.set(fileId, samples);
}

export function getSpeedBytesPerSec(fileId: string): number {
  const samples = samplesByFile.get(fileId);
  if (!samples || samples.length < 2) return 0;

  const first = samples[0];
  const last = samples[samples.length - 1];
  const deltaBytes = last.bytesSent - first.bytesSent;
  const deltaSeconds = (last.timestamp - first.timestamp) / 1000;
  if (deltaSeconds <= 0 || deltaBytes <= 0) return 0;
  return deltaBytes / deltaSeconds;
}

export function getETASeconds(
  fileId: string,
  bytesRemaining: number,
): number | null {
  const speed = getSpeedBytesPerSec(fileId);
  if (speed <= 0 || bytesRemaining <= 0) return null;

  return bytesRemaining / speed;
}

export function clearFileSpeed(fileId: string) {
  samplesByFile.delete(fileId);
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return "";
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024)
    return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function formatETA(seconds: number | null): string {
  if (seconds === null || !isFinite(seconds)) return "";
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m left`;
  return `${(seconds / 3600).toFixed(1)}h left`;
}
