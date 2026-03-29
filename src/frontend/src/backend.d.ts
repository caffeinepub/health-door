import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface UserProfile {
    name: string;
}
export interface ScanRecord {
    medicine_name: string;
    manufacturing_date: string;
    imageUrl: string;
    expiry_date: string;
    timestamp: bigint;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    analyzeImage(base64Data: string, mimeType: string): Promise<string>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getScans(): Promise<Array<ScanRecord>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    saveScan(medicineName: string, manufacturingDate: string, expiryDate: string, imageUrl: string): Promise<void>;
}
