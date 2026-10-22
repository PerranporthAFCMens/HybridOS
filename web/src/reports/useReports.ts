import { useQuery } from '@tanstack/react-query';
import { loadLibraryData } from '../data/reportLibrary';
import { rangeStart } from './calc';

/** Everything the report library needs for one date range. Loaded when a report page or the summary is opened. */
export function useLibraryData(gymId: string, rangeDays: number, enabled: boolean) {
  return useQuery({
    queryKey: ['report-library', gymId, rangeDays],
    enabled,
    queryFn: () => loadLibraryData(gymId, rangeStart(rangeDays, new Date())),
  });
}
