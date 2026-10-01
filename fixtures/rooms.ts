import "server-only";
import roomsData from "./server-only/rooms.json";

export interface Room {
  id: string;
  name: string;
  url: string;
}

export const rooms: Room[] = roomsData as Room[];
