import type { Prisma } from '@prisma/client';
import { prisma } from '../src/db/prisma.ts';
import { hashPassword } from '../src/utils/password.ts';
import { describeErrorForLog } from '../src/utils/safe-error-log.ts';

/**
 * Development/demo seed.
 *
 * - Refuses to run when NODE_ENV=production.
 * - Idempotent: every row uses a fixed UUID and is upserted, so re-running updates the demo
 *   data without creating duplicates.
 * - Uses fake `.test` identities only and prints the demo logins after a successful run.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const now = new Date();

function hoursAgo(hours: number): Date {
  return new Date(now.getTime() - hours * HOUR_MS);
}

function hoursFromNow(hours: number): Date {
  return new Date(now.getTime() + hours * HOUR_MS);
}

function daysAgo(days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

const USER = {
  admin: '00000000-0000-4000-8000-000000000001',
  donorVerified: '00000000-0000-4000-8000-000000000002',
  donorPending: '00000000-0000-4000-8000-000000000003',
  donorRejected: '00000000-0000-4000-8000-000000000004',
  ngoVerified: '00000000-0000-4000-8000-000000000005',
  ngoVerified2: '00000000-0000-4000-8000-000000000006',
  ngoRejected: '00000000-0000-4000-8000-000000000007',
} as const;

const ORG = {
  greenLeaf: '10000000-0000-4000-8000-000000000002',
  campusCanteen: '10000000-0000-4000-8000-000000000003',
  sunsetBistro: '10000000-0000-4000-8000-000000000004',
  hopeKitchen: '20000000-0000-4000-8000-000000000001',
  cityHarvest: '20000000-0000-4000-8000-000000000002',
  openHands: '20000000-0000-4000-8000-000000000003',
} as const;

const DONATION = {
  available: '30000000-0000-4000-8000-000000000001',
  claimed: '30000000-0000-4000-8000-000000000002',
  pickedUp: '30000000-0000-4000-8000-000000000003',
  completed: '30000000-0000-4000-8000-000000000004',
  expired: '30000000-0000-4000-8000-000000000005',
  cancelled: '30000000-0000-4000-8000-000000000006',
} as const;

const CLAIM = {
  released: '40000000-0000-4000-8000-000000000001',
  activeHope: '40000000-0000-4000-8000-000000000002',
  activeCityHarvest: '40000000-0000-4000-8000-000000000003',
  completed: '40000000-0000-4000-8000-000000000004',
  cancelledOnCancelledDonation: '40000000-0000-4000-8000-000000000005',
} as const;

const SEEDED_LOGINS = [
  {
    email: 'admin@food-demo.test',
    password: 'Admin1234!',
    role: 'admin',
    organisation: '—',
    status: '—',
  },
  {
    email: 'donor.verified@food-demo.test',
    password: 'Demo1234!',
    role: 'donor',
    organisation: 'Green Leaf Kitchen',
    status: 'verified',
  },
  {
    email: 'donor.pending@food-demo.test',
    password: 'Demo1234!',
    role: 'donor',
    organisation: 'Campus Canteen',
    status: 'pending',
  },
  {
    email: 'donor.rejected@food-demo.test',
    password: 'Demo1234!',
    role: 'donor',
    organisation: 'Sunset Bistro',
    status: 'rejected',
  },
  {
    email: 'ngo.verified@food-demo.test',
    password: 'Demo1234!',
    role: 'ngo',
    organisation: 'Hope Kitchen',
    status: 'verified',
  },
  {
    email: 'ngo.verified2@food-demo.test',
    password: 'Demo1234!',
    role: 'ngo',
    organisation: 'City Harvest',
    status: 'verified',
  },
  {
    email: 'ngo.rejected@food-demo.test',
    password: 'Demo1234!',
    role: 'ngo',
    organisation: 'Open Hands',
    status: 'rejected',
  },
] as const;

const USERS = [
  {
    id: USER.admin,
    email: 'admin@food-demo.test',
    password: 'Admin1234!',
    role: 'admin',
    organisationId: null,
  },
  {
    id: USER.donorVerified,
    email: 'donor.verified@food-demo.test',
    password: 'Demo1234!',
    role: 'donor',
    organisationId: ORG.greenLeaf,
  },
  {
    id: USER.donorPending,
    email: 'donor.pending@food-demo.test',
    password: 'Demo1234!',
    role: 'donor',
    organisationId: ORG.campusCanteen,
  },
  {
    id: USER.donorRejected,
    email: 'donor.rejected@food-demo.test',
    password: 'Demo1234!',
    role: 'donor',
    organisationId: ORG.sunsetBistro,
  },
  {
    id: USER.ngoVerified,
    email: 'ngo.verified@food-demo.test',
    password: 'Demo1234!',
    role: 'ngo',
    organisationId: ORG.hopeKitchen,
  },
  {
    id: USER.ngoVerified2,
    email: 'ngo.verified2@food-demo.test',
    password: 'Demo1234!',
    role: 'ngo',
    organisationId: ORG.cityHarvest,
  },
  {
    id: USER.ngoRejected,
    email: 'ngo.rejected@food-demo.test',
    password: 'Demo1234!',
    role: 'ngo',
    organisationId: ORG.openHands,
  },
] as const;

const ORGANISATIONS = [
  {
    id: ORG.greenLeaf,
    type: 'donor',
    name: 'Green Leaf Kitchen',
    registrationNumber: 'DON-1001',
    contactName: 'Maya Rao',
    contactPhone: '+15550101',
    contactEmail: 'contact@greenleaf.test',
    addressLine1: '12 Market Street',
    addressLine2: null,
    area: 'Downtown',
    city: 'Springfield',
    postcode: '10001',
    verificationStatus: 'verified',
    verificationSubmittedAt: daysAgo(10),
    verifiedAt: daysAgo(9),
    verifiedByUserId: USER.admin,
    rejectionReason: null,
    createdAt: daysAgo(12),
  },
  {
    id: ORG.campusCanteen,
    type: 'donor',
    name: 'Campus Canteen',
    registrationNumber: 'DON-1002',
    contactName: 'Arjun Mehta',
    contactPhone: '+15550102',
    contactEmail: 'contact@campuscanteen.test',
    addressLine1: '8 University Road',
    addressLine2: null,
    area: 'University',
    city: 'Springfield',
    postcode: '10002',
    verificationStatus: 'pending',
    verificationSubmittedAt: daysAgo(2),
    verifiedAt: null,
    verifiedByUserId: null,
    rejectionReason: null,
    createdAt: daysAgo(3),
  },
  {
    id: ORG.sunsetBistro,
    type: 'donor',
    name: 'Sunset Bistro',
    registrationNumber: 'DON-1003',
    contactName: 'Elena Rossi',
    contactPhone: '+15550103',
    contactEmail: 'contact@sunsetbistro.test',
    addressLine1: '44 Sunset Avenue',
    addressLine2: 'Side entrance',
    area: 'Riverside',
    city: 'Springfield',
    postcode: '10003',
    verificationStatus: 'rejected',
    verificationSubmittedAt: daysAgo(6),
    verifiedAt: null,
    verifiedByUserId: null,
    rejectionReason: 'The food safety licence has expired.',
    createdAt: daysAgo(7),
  },
  {
    id: ORG.hopeKitchen,
    type: 'ngo',
    name: 'Hope Kitchen',
    registrationNumber: 'NGO-2001',
    contactName: 'Nadia Khan',
    contactPhone: '+15550201',
    contactEmail: 'contact@hopekitchen.test',
    addressLine1: '5 Hope Lane',
    addressLine2: null,
    area: 'Eastside',
    city: 'Springfield',
    postcode: '20001',
    verificationStatus: 'verified',
    verificationSubmittedAt: daysAgo(10),
    verifiedAt: daysAgo(9),
    verifiedByUserId: USER.admin,
    rejectionReason: null,
    createdAt: daysAgo(12),
  },
  {
    id: ORG.cityHarvest,
    type: 'ngo',
    name: 'City Harvest',
    registrationNumber: 'NGO-2002',
    contactName: 'Tomas Silva',
    contactPhone: '+15550202',
    contactEmail: 'contact@cityharvest.test',
    addressLine1: '19 Orchard Road',
    addressLine2: null,
    area: 'Northside',
    city: 'Springfield',
    postcode: '20002',
    verificationStatus: 'verified',
    verificationSubmittedAt: daysAgo(10),
    verifiedAt: daysAgo(9),
    verifiedByUserId: USER.admin,
    rejectionReason: null,
    createdAt: daysAgo(12),
  },
  {
    id: ORG.openHands,
    type: 'ngo',
    name: 'Open Hands',
    registrationNumber: 'NGO-2003',
    contactName: 'Priya Nair',
    contactPhone: '+15550203',
    contactEmail: 'contact@openhands.test',
    addressLine1: '3 Open Square',
    addressLine2: null,
    area: 'Westside',
    city: 'Springfield',
    postcode: '20003',
    verificationStatus: 'rejected',
    verificationSubmittedAt: daysAgo(6),
    verifiedAt: null,
    verifiedByUserId: null,
    rejectionReason: 'Registration document is not legible.',
    createdAt: daysAgo(7),
  },
] as const;

const DOCUMENTS = [
  {
    id: '50000000-0000-4000-8000-000000000001',
    organisationId: ORG.campusCanteen,
    uploadedByUserId: USER.donorPending,
    documentType: 'food_safety_licence',
    status: 'pending',
    storageKey: 'seed/campus-canteen-food-safety.pdf',
    originalFilename: 'campus-canteen-food-safety.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 245760,
    reviewNote: null,
    reviewedByUserId: null,
    reviewedAt: null,
    uploadedAt: daysAgo(2),
  },
  {
    id: '50000000-0000-4000-8000-000000000002',
    organisationId: ORG.campusCanteen,
    uploadedByUserId: USER.donorPending,
    documentType: 'business_registration',
    status: 'pending',
    storageKey: 'seed/campus-canteen-business-registration.pdf',
    originalFilename: 'campus-canteen-business-registration.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 182400,
    reviewNote: null,
    reviewedByUserId: null,
    reviewedAt: null,
    uploadedAt: daysAgo(2),
  },
  {
    id: '50000000-0000-4000-8000-000000000003',
    organisationId: ORG.sunsetBistro,
    uploadedByUserId: USER.donorRejected,
    documentType: 'food_safety_licence',
    status: 'rejected',
    storageKey: 'seed/sunset-bistro-food-safety.pdf',
    originalFilename: 'sunset-bistro-food-safety.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 201728,
    reviewNote: 'The licence expired on 2026-10-31.',
    reviewedByUserId: USER.admin,
    reviewedAt: daysAgo(4),
    uploadedAt: daysAgo(6),
  },
  {
    id: '50000000-0000-4000-8000-000000000004',
    organisationId: ORG.sunsetBistro,
    uploadedByUserId: USER.donorRejected,
    documentType: 'business_registration',
    status: 'approved',
    storageKey: 'seed/sunset-bistro-business-registration.pdf',
    originalFilename: 'sunset-bistro-business-registration.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 176128,
    reviewNote: 'Registration is valid.',
    reviewedByUserId: USER.admin,
    reviewedAt: daysAgo(4),
    uploadedAt: daysAgo(6),
  },
  {
    id: '50000000-0000-4000-8000-000000000005',
    organisationId: ORG.openHands,
    uploadedByUserId: USER.ngoRejected,
    documentType: 'food_safety_licence',
    status: 'approved',
    storageKey: 'seed/open-hands-food-safety.pdf',
    originalFilename: 'open-hands-food-safety.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 198656,
    reviewNote: 'Valid until 2027.',
    reviewedByUserId: USER.admin,
    reviewedAt: daysAgo(4),
    uploadedAt: daysAgo(6),
  },
  {
    id: '50000000-0000-4000-8000-000000000006',
    organisationId: ORG.openHands,
    uploadedByUserId: USER.ngoRejected,
    documentType: 'ngo_registration',
    status: 'rejected',
    storageKey: 'seed/open-hands-ngo-registration.pdf',
    originalFilename: 'open-hands-ngo-registration.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 163840,
    reviewNote: 'Registration document is not legible.',
    reviewedByUserId: USER.admin,
    reviewedAt: daysAgo(4),
    uploadedAt: daysAgo(6),
  },
  {
    id: '50000000-0000-4000-8000-000000000007',
    organisationId: ORG.greenLeaf,
    uploadedByUserId: USER.donorVerified,
    documentType: 'food_safety_licence',
    status: 'approved',
    storageKey: 'seed/green-leaf-food-safety.pdf',
    originalFilename: 'green-leaf-food-safety.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 232448,
    reviewNote: 'Valid until 2027.',
    reviewedByUserId: USER.admin,
    reviewedAt: daysAgo(9),
    uploadedAt: daysAgo(10),
  },
  {
    id: '50000000-0000-4000-8000-000000000008',
    organisationId: ORG.greenLeaf,
    uploadedByUserId: USER.donorVerified,
    documentType: 'business_registration',
    status: 'approved',
    storageKey: 'seed/green-leaf-business-registration.pdf',
    originalFilename: 'green-leaf-business-registration.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 154624,
    reviewNote: 'Registration is valid.',
    reviewedByUserId: USER.admin,
    reviewedAt: daysAgo(9),
    uploadedAt: daysAgo(10),
  },
  {
    id: '50000000-0000-4000-8000-000000000009',
    organisationId: ORG.hopeKitchen,
    uploadedByUserId: USER.ngoVerified,
    documentType: 'food_safety_licence',
    status: 'approved',
    storageKey: 'seed/hope-kitchen-food-safety.pdf',
    originalFilename: 'hope-kitchen-food-safety.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 221184,
    reviewNote: 'Valid until 2027.',
    reviewedByUserId: USER.admin,
    reviewedAt: daysAgo(9),
    uploadedAt: daysAgo(10),
  },
  {
    id: '50000000-0000-4000-8000-000000000010',
    organisationId: ORG.hopeKitchen,
    uploadedByUserId: USER.ngoVerified,
    documentType: 'ngo_registration',
    status: 'approved',
    storageKey: 'seed/hope-kitchen-ngo-registration.pdf',
    originalFilename: 'hope-kitchen-ngo-registration.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 143360,
    reviewNote: 'Registration is valid.',
    reviewedByUserId: USER.admin,
    reviewedAt: daysAgo(9),
    uploadedAt: daysAgo(10),
  },
  {
    id: '50000000-0000-4000-8000-000000000011',
    organisationId: ORG.cityHarvest,
    uploadedByUserId: USER.ngoVerified2,
    documentType: 'food_safety_licence',
    status: 'approved',
    storageKey: 'seed/city-harvest-food-safety.pdf',
    originalFilename: 'city-harvest-food-safety.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 208896,
    reviewNote: 'Valid until 2027.',
    reviewedByUserId: USER.admin,
    reviewedAt: daysAgo(9),
    uploadedAt: daysAgo(10),
  },
  {
    id: '50000000-0000-4000-8000-000000000012',
    organisationId: ORG.cityHarvest,
    uploadedByUserId: USER.ngoVerified2,
    documentType: 'ngo_registration',
    status: 'approved',
    storageKey: 'seed/city-harvest-ngo-registration.pdf',
    originalFilename: 'city-harvest-ngo-registration.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 139264,
    reviewNote: 'Registration is valid.',
    reviewedByUserId: USER.admin,
    reviewedAt: daysAgo(9),
    uploadedAt: daysAgo(10),
  },
] as const;

const DONATIONS = [
  {
    id: DONATION.available,
    title: 'Vegetable curry and rice',
    description: 'Freshly cooked vegetarian curry with steamed rice.',
    isVegetarian: true,
    quantity: 12.5,
    unit: 'kg',
    bestBefore: hoursFromNow(12),
    pickupWindowStart: hoursFromNow(4),
    pickupWindowEnd: hoursFromNow(8),
    pickupAddressLine1: '12 Market Street',
    pickupAddressLine2: 'Rear entrance',
    pickupArea: 'Downtown',
    pickupCity: 'Springfield',
    pickupPostcode: '10001',
    pickupInstructions: 'Ring the bell at the rear entrance.',
    allergenNotes: 'Contains dairy.',
    status: 'available',
    cancelledByUserId: null,
    cancelReason: null,
    cancelledAt: null,
    completedAt: null,
    createdAt: hoursAgo(36),
  },
  {
    id: DONATION.claimed,
    title: 'Fresh fruit boxes',
    description: 'Assorted seasonal fruit in returnable crates.',
    isVegetarian: true,
    quantity: 6.5,
    unit: 'kg',
    bestBefore: hoursFromNow(10),
    pickupWindowStart: hoursFromNow(2),
    pickupWindowEnd: hoursFromNow(6),
    pickupAddressLine1: '12 Market Street',
    pickupAddressLine2: null,
    pickupArea: 'Downtown',
    pickupCity: 'Springfield',
    pickupPostcode: '10001',
    pickupInstructions: 'Ask for Maya at the side counter.',
    allergenNotes: null,
    status: 'claimed',
    cancelledByUserId: null,
    cancelReason: null,
    cancelledAt: null,
    completedAt: null,
    createdAt: hoursAgo(6),
  },
  {
    id: DONATION.pickedUp,
    title: 'Rice and lentil tray',
    description: 'Large tray of rice with lentil dal, packed for transport.',
    isVegetarian: true,
    quantity: 10,
    unit: 'kg',
    bestBefore: hoursFromNow(4),
    pickupWindowStart: hoursAgo(6),
    pickupWindowEnd: hoursAgo(2),
    pickupAddressLine1: '12 Market Street',
    pickupAddressLine2: 'Kitchen door',
    pickupArea: 'Downtown',
    pickupCity: 'Springfield',
    pickupPostcode: '10001',
    pickupInstructions: 'Use the kitchen door on the alley.',
    allergenNotes: 'Contains lentils.',
    status: 'picked_up',
    cancelledByUserId: null,
    cancelReason: null,
    cancelledAt: null,
    completedAt: null,
    createdAt: hoursAgo(30),
  },
  {
    id: DONATION.completed,
    title: 'Bread and pastries',
    description: 'Day-old bread and pastries from the morning bake.',
    isVegetarian: true,
    quantity: 4.5,
    unit: 'kg',
    bestBefore: hoursAgo(50),
    pickupWindowStart: hoursAgo(60),
    pickupWindowEnd: hoursAgo(55),
    pickupAddressLine1: '12 Market Street',
    pickupAddressLine2: null,
    pickupArea: 'Downtown',
    pickupCity: 'Springfield',
    pickupPostcode: '10001',
    pickupInstructions: 'Collect from the front counter.',
    allergenNotes: 'Contains gluten and dairy.',
    status: 'completed',
    cancelledByUserId: null,
    cancelReason: null,
    cancelledAt: null,
    completedAt: hoursAgo(48),
    createdAt: hoursAgo(80),
  },
  {
    id: DONATION.expired,
    title: 'Soup and sandwiches',
    description: 'Packed soup portions with assorted sandwiches.',
    isVegetarian: false,
    quantity: 5,
    unit: 'kg',
    bestBefore: hoursAgo(50),
    pickupWindowStart: hoursAgo(60),
    pickupWindowEnd: hoursAgo(55),
    pickupAddressLine1: '12 Market Street',
    pickupAddressLine2: null,
    pickupArea: 'Downtown',
    pickupCity: 'Springfield',
    pickupPostcode: '10001',
    pickupInstructions: null,
    allergenNotes: 'May contain traces of nuts.',
    status: 'expired',
    cancelledByUserId: null,
    cancelReason: null,
    cancelledAt: null,
    completedAt: null,
    createdAt: hoursAgo(70),
  },
  {
    id: DONATION.cancelled,
    title: 'Pasta bake',
    description: 'Vegetable pasta bake in foil trays.',
    isVegetarian: true,
    quantity: 7.5,
    unit: 'kg',
    bestBefore: hoursFromNow(30),
    pickupWindowStart: hoursFromNow(20),
    pickupWindowEnd: hoursFromNow(24),
    pickupAddressLine1: '12 Market Street',
    pickupAddressLine2: 'Rear entrance',
    pickupArea: 'Downtown',
    pickupCity: 'Springfield',
    pickupPostcode: '10001',
    pickupInstructions: 'Ring the bell at the rear entrance.',
    allergenNotes: 'Contains gluten and dairy.',
    status: 'cancelled',
    cancelledByUserId: USER.donorVerified,
    cancelReason: 'Kitchen closed for the demo day.',
    cancelledAt: hoursAgo(15),
    completedAt: null,
    createdAt: hoursAgo(20),
  },
] as const;

const CLAIMS = [
  {
    id: CLAIM.released,
    donationId: DONATION.available,
    ngoOrganisationId: ORG.hopeKitchen,
    claimedByUserId: USER.ngoVerified,
    status: 'cancelled',
    claimedAt: hoursAgo(30),
    pickupConfirmedAt: null,
    completedAt: null,
    cancelledAt: hoursAgo(26),
    cancelledByUserId: USER.ngoVerified,
    cancelReason: 'Could not collect within the demo window.',
  },
  {
    id: CLAIM.activeHope,
    donationId: DONATION.claimed,
    ngoOrganisationId: ORG.hopeKitchen,
    claimedByUserId: USER.ngoVerified,
    status: 'active',
    claimedAt: hoursAgo(3),
    pickupConfirmedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelledByUserId: null,
    cancelReason: null,
  },
  {
    id: CLAIM.activeCityHarvest,
    donationId: DONATION.pickedUp,
    ngoOrganisationId: ORG.cityHarvest,
    claimedByUserId: USER.ngoVerified2,
    status: 'active',
    claimedAt: hoursAgo(10),
    pickupConfirmedAt: hoursAgo(3),
    completedAt: null,
    cancelledAt: null,
    cancelledByUserId: null,
    cancelReason: null,
  },
  {
    id: CLAIM.completed,
    donationId: DONATION.completed,
    ngoOrganisationId: ORG.hopeKitchen,
    claimedByUserId: USER.ngoVerified,
    status: 'completed',
    claimedAt: hoursAgo(65),
    pickupConfirmedAt: hoursAgo(56),
    completedAt: hoursAgo(48),
    cancelledAt: null,
    cancelledByUserId: null,
    cancelReason: null,
  },
  {
    id: CLAIM.cancelledOnCancelledDonation,
    donationId: DONATION.cancelled,
    ngoOrganisationId: ORG.cityHarvest,
    claimedByUserId: USER.ngoVerified2,
    status: 'cancelled',
    claimedAt: hoursAgo(18),
    pickupConfirmedAt: null,
    completedAt: null,
    cancelledAt: hoursAgo(15),
    cancelledByUserId: USER.donorVerified,
    cancelReason: 'Kitchen closed for the demo day.',
  },
] as const;

const STATUS_HISTORY = [
  {
    id: '70000000-0000-4000-8000-000000000001',
    donationId: DONATION.available,
    fromStatus: null,
    toStatus: 'available',
    changedByUserId: USER.donorVerified,
    reason: null,
    createdAt: hoursAgo(36),
  },
  {
    id: '70000000-0000-4000-8000-000000000002',
    donationId: DONATION.available,
    fromStatus: 'available',
    toStatus: 'claimed',
    changedByUserId: USER.ngoVerified,
    reason: null,
    createdAt: hoursAgo(30),
  },
  {
    id: '70000000-0000-4000-8000-000000000003',
    donationId: DONATION.available,
    fromStatus: 'claimed',
    toStatus: 'available',
    changedByUserId: USER.ngoVerified,
    reason: 'Could not collect within the demo window.',
    createdAt: hoursAgo(26),
  },
  {
    id: '70000000-0000-4000-8000-000000000004',
    donationId: DONATION.claimed,
    fromStatus: null,
    toStatus: 'available',
    changedByUserId: USER.donorVerified,
    reason: null,
    createdAt: hoursAgo(6),
  },
  {
    id: '70000000-0000-4000-8000-000000000005',
    donationId: DONATION.claimed,
    fromStatus: 'available',
    toStatus: 'claimed',
    changedByUserId: USER.ngoVerified,
    reason: null,
    createdAt: hoursAgo(3),
  },
  {
    id: '70000000-0000-4000-8000-000000000006',
    donationId: DONATION.pickedUp,
    fromStatus: null,
    toStatus: 'available',
    changedByUserId: USER.donorVerified,
    reason: null,
    createdAt: hoursAgo(30),
  },
  {
    id: '70000000-0000-4000-8000-000000000007',
    donationId: DONATION.pickedUp,
    fromStatus: 'available',
    toStatus: 'claimed',
    changedByUserId: USER.ngoVerified2,
    reason: null,
    createdAt: hoursAgo(10),
  },
  {
    id: '70000000-0000-4000-8000-000000000008',
    donationId: DONATION.pickedUp,
    fromStatus: 'claimed',
    toStatus: 'picked_up',
    changedByUserId: USER.ngoVerified2,
    reason: null,
    createdAt: hoursAgo(3),
  },
  {
    id: '70000000-0000-4000-8000-000000000009',
    donationId: DONATION.completed,
    fromStatus: null,
    toStatus: 'available',
    changedByUserId: USER.donorVerified,
    reason: null,
    createdAt: hoursAgo(80),
  },
  {
    id: '70000000-0000-4000-8000-000000000010',
    donationId: DONATION.completed,
    fromStatus: 'available',
    toStatus: 'claimed',
    changedByUserId: USER.ngoVerified,
    reason: null,
    createdAt: hoursAgo(65),
  },
  {
    id: '70000000-0000-4000-8000-000000000011',
    donationId: DONATION.completed,
    fromStatus: 'claimed',
    toStatus: 'picked_up',
    changedByUserId: USER.ngoVerified,
    reason: null,
    createdAt: hoursAgo(56),
  },
  {
    id: '70000000-0000-4000-8000-000000000012',
    donationId: DONATION.completed,
    fromStatus: 'picked_up',
    toStatus: 'completed',
    changedByUserId: USER.donorVerified,
    reason: null,
    createdAt: hoursAgo(48),
  },
  {
    id: '70000000-0000-4000-8000-000000000013',
    donationId: DONATION.expired,
    fromStatus: null,
    toStatus: 'available',
    changedByUserId: USER.donorVerified,
    reason: null,
    createdAt: hoursAgo(70),
  },
  {
    id: '70000000-0000-4000-8000-000000000014',
    donationId: DONATION.expired,
    fromStatus: 'available',
    toStatus: 'expired',
    changedByUserId: null,
    reason: 'Pickup window ended.',
    createdAt: hoursAgo(55),
  },
  {
    id: '70000000-0000-4000-8000-000000000015',
    donationId: DONATION.cancelled,
    fromStatus: null,
    toStatus: 'available',
    changedByUserId: USER.donorVerified,
    reason: null,
    createdAt: hoursAgo(20),
  },
  {
    id: '70000000-0000-4000-8000-000000000016',
    donationId: DONATION.cancelled,
    fromStatus: 'available',
    toStatus: 'claimed',
    changedByUserId: USER.ngoVerified2,
    reason: null,
    createdAt: hoursAgo(18),
  },
  {
    id: '70000000-0000-4000-8000-000000000017',
    donationId: DONATION.cancelled,
    fromStatus: 'claimed',
    toStatus: 'cancelled',
    changedByUserId: USER.donorVerified,
    reason: 'Kitchen closed for the demo day.',
    createdAt: hoursAgo(15),
  },
] as const;

const NOTIFICATIONS = [
  {
    id: '60000000-0000-4000-8000-000000000001',
    userId: USER.donorVerified,
    type: 'organisation_verified',
    title: 'Organisation verified',
    body: 'Green Leaf Kitchen is now verified.',
    donationId: null,
    claimId: null,
    readAt: daysAgo(8),
    createdAt: daysAgo(9),
  },
  {
    id: '60000000-0000-4000-8000-000000000002',
    userId: USER.ngoVerified,
    type: 'organisation_verified',
    title: 'Organisation verified',
    body: 'Hope Kitchen is now verified.',
    donationId: null,
    claimId: null,
    readAt: null,
    createdAt: daysAgo(9),
  },
  {
    id: '60000000-0000-4000-8000-000000000003',
    userId: USER.ngoVerified2,
    type: 'organisation_verified',
    title: 'Organisation verified',
    body: 'City Harvest is now verified.',
    donationId: null,
    claimId: null,
    readAt: null,
    createdAt: daysAgo(9),
  },
  {
    id: '60000000-0000-4000-8000-000000000004',
    userId: USER.donorRejected,
    type: 'organisation_rejected',
    title: 'Organisation verification rejected',
    body: 'Sunset Bistro was rejected: The food safety licence has expired.',
    donationId: null,
    claimId: null,
    readAt: null,
    createdAt: daysAgo(4),
  },
  {
    id: '60000000-0000-4000-8000-000000000005',
    userId: USER.ngoRejected,
    type: 'organisation_rejected',
    title: 'Organisation verification rejected',
    body: 'Open Hands was rejected: Registration document is not legible.',
    donationId: null,
    claimId: null,
    readAt: null,
    createdAt: daysAgo(4),
  },
  {
    id: '60000000-0000-4000-8000-000000000006',
    userId: USER.donorVerified,
    type: 'claim_released',
    title: 'Claim released',
    body: 'Hope Kitchen released its claim on "Vegetable curry and rice".',
    donationId: DONATION.available,
    claimId: CLAIM.released,
    readAt: null,
    createdAt: hoursAgo(26),
  },
  {
    id: '60000000-0000-4000-8000-000000000007',
    userId: USER.donorVerified,
    type: 'donation_claimed',
    title: 'Your donation was claimed',
    body: 'Hope Kitchen claimed "Fresh fruit boxes".',
    donationId: DONATION.claimed,
    claimId: CLAIM.activeHope,
    readAt: null,
    createdAt: hoursAgo(3),
  },
  {
    id: '60000000-0000-4000-8000-000000000008',
    userId: USER.donorVerified,
    type: 'pickup_confirmed',
    title: 'Pickup confirmed',
    body: 'City Harvest confirmed pickup for "Rice and lentil tray".',
    donationId: DONATION.pickedUp,
    claimId: CLAIM.activeCityHarvest,
    readAt: null,
    createdAt: hoursAgo(3),
  },
  {
    id: '60000000-0000-4000-8000-000000000009',
    userId: USER.donorVerified,
    type: 'donation_completed',
    title: 'Donation completed',
    body: 'Hope Kitchen completed "Bread and pastries".',
    donationId: DONATION.completed,
    claimId: CLAIM.completed,
    readAt: hoursAgo(47),
    createdAt: hoursAgo(48),
  },
  {
    id: '60000000-0000-4000-8000-000000000010',
    userId: USER.donorVerified,
    type: 'donation_expired',
    title: 'Donation expired',
    body: '"Soup and sandwiches" expired without a claim.',
    donationId: DONATION.expired,
    claimId: null,
    readAt: null,
    createdAt: hoursAgo(55),
  },
  {
    id: '60000000-0000-4000-8000-000000000011',
    userId: USER.ngoVerified,
    type: 'donation_completed',
    title: 'Donation completed',
    body: '"Bread and pastries" was completed. Thank you!',
    donationId: DONATION.completed,
    claimId: CLAIM.completed,
    readAt: null,
    createdAt: hoursAgo(48),
  },
  {
    id: '60000000-0000-4000-8000-000000000012',
    userId: USER.ngoVerified2,
    type: 'donation_cancelled',
    title: 'Donation cancelled',
    body: 'Green Leaf Kitchen cancelled "Pasta bake".',
    donationId: DONATION.cancelled,
    claimId: CLAIM.cancelledOnCancelledDonation,
    readAt: null,
    createdAt: hoursAgo(15),
  },
] as const;

async function seed(): Promise<void> {
  const passwordHashById = new Map<string, string>();

  for (const user of USERS) {
    passwordHashById.set(user.id, await hashPassword(user.password));
  }

  async function upsertUser(tx: Prisma.TransactionClient, user: (typeof USERS)[number]): Promise<void> {
    const passwordHash = passwordHashById.get(user.id);

    if (passwordHash === undefined) {
      throw new Error('Seed password hash missing for a seeded user.');
    }

    const data = {
      email: user.email,
      role: user.role,
      passwordHash,
      organisationId: user.organisationId,
      emailVerifiedAt: daysAgo(10),
      isActive: true,
      lastLoginAt: null,
    };

    await tx.user.upsert({
      where: { id: user.id },
      create: { id: user.id, ...data },
      update: data,
    });
  }

  await prisma.$transaction(
    async (tx) => {
      // Admins have no organisation, so create the admin user before verified organisations
      // that reference it through `verified_by_user_id`.
      for (const user of USERS) {
        if (user.organisationId === null) {
          await upsertUser(tx, user);
        }
      }

      for (const organisation of ORGANISATIONS) {
        const { id, createdAt, ...mutable } = organisation;

        await tx.organisation.upsert({
          where: { id },
          create: { id, ...mutable, createdAt },
          update: { ...mutable, updatedAt: new Date() },
        });
      }

      // Organisations now exist, so the donor and NGO users can reference them.
      for (const user of USERS) {
        if (user.organisationId !== null) {
          await upsertUser(tx, user);
        }
      }

      for (const document of DOCUMENTS) {
        const { id, ...data } = document;

        await tx.verificationDocument.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });
      }

      for (const donation of DONATIONS) {
        const { id, createdAt, ...data } = donation;

        await tx.donation.upsert({
          where: { id },
          create: {
            id,
            donorOrganisationId: ORG.greenLeaf,
            ...data,
            createdAt,
            version: 0,
            photoStorageKey: null,
          },
          update: {
            donorOrganisationId: ORG.greenLeaf,
            ...data,
            version: 0,
            photoStorageKey: null,
          },
        });
      }

      for (const claim of CLAIMS) {
        const { id, ...data } = claim;

        await tx.claim.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });
      }

      for (const history of STATUS_HISTORY) {
        const { id, ...data } = history;

        await tx.donationStatusHistory.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });
      }

      for (const notification of NOTIFICATIONS) {
        const { id, ...data } = notification;

        await tx.notification.upsert({
          where: { id },
          create: { id, ...data, emailedAt: null },
          update: { ...data, emailedAt: null },
        });
      }
    },
    { timeout: 30_000 },
  );
}

function printSeededLogins(): void {
  console.log('');
  console.log('Demo seed complete. Seeded logins (development/test only):');
  console.log('');
  console.log('  Email                            Password    Role   Organisation        Status');
  console.log('  -------------------------------  ----------  -----  ------------------  ---------');

  for (const login of SEEDED_LOGINS) {
    const email = login.email.padEnd(31);
    const password = login.password.padEnd(10);
    const role = login.role.padEnd(5);
    const organisation = login.organisation.padEnd(18);
    console.log(`  ${email}  ${password}  ${role}  ${organisation}  ${login.status}`);
  }

  console.log('');
  console.log('Never use these credentials outside local development or demos.');
  console.log('');
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV=production. The demo seed is for development and test only.');
    process.exitCode = 1;
    return;
  }

  try {
    await seed();
    printSeededLogins();
  } catch (error) {
    const safe = describeErrorForLog(error);
    const code = safe.errorCode === null ? '' : ` (${safe.errorCode})`;
    console.error(`Seed failed: ${safe.errorName}${code}. No query arguments or personal data were logged.`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
