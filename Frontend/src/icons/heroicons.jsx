import React from 'react';

const iconPaths = {
  ArrowLeftIcon: 'M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18',
  ArrowDownTrayIcon: 'M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4.5 15v3.75A2.25 2.25 0 0 0 6.75 21h10.5a2.25 2.25 0 0 0 2.25-2.25V15',
  ArrowRightIcon: 'M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3',
  ArrowRightOnRectangleIcon: 'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6A2.25 2.25 0 0 0 5.25 5.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H3',
  ArrowPathIcon: 'M16.023 9.348h4.992V4.356M20.49 9A8.25 8.25 0 0 0 5.64 5.64M7.977 14.652H2.985v4.992M3.51 15a8.25 8.25 0 0 0 14.85 3.36',
  ArrowTrendingUpIcon: 'm2.25 18 8.954-8.955 4.5 4.5L21.75 7.5M18 7.5h3.75v3.75',
  ArchiveBoxArrowDownIcon: 'M3.75 7.5h16.5M5.25 7.5v10.125A2.625 2.625 0 0 0 7.875 20.25h8.25a2.625 2.625 0 0 0 2.625-2.625V7.5M8.25 7.5V4.875c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125V7.5M12 10.5v6m0 0 2.25-2.25M12 16.5l-2.25-2.25',
  BanknotesIcon: 'M2.25 18.75h19.5V8.25H2.25v10.5Zm3-7.5h13.5m-12 4.5h3m7.5 0h.008M6.75 5.25h10.5',
  BellIcon: 'M14.857 17.082a2.625 2.625 0 0 1-5.714 0M18 8.25a6 6 0 1 0-12 0c0 7.5-3 8.25-3 8.25h18s-3-.75-3-8.25Z',
  BuildingOfficeIcon: 'M3.75 21h16.5M4.5 21V6.75A2.25 2.25 0 0 1 6.75 4.5h6A2.25 2.25 0 0 1 15 6.75V21m4.5 0V9.75A2.25 2.25 0 0 0 17.25 7.5H15M8.25 9h3m-3 3h3m-3 3h3',
  CalendarDaysIcon: 'M6.75 3v2.25M17.25 3v2.25M3.75 9h16.5M5.25 5.25h13.5A1.5 1.5 0 0 1 20.25 6.75v12A1.5 1.5 0 0 1 18.75 20.25H5.25A1.5 1.5 0 0 1 3.75 18.75v-12A1.5 1.5 0 0 1 5.25 5.25Z',
  ChartBarIcon: 'M3 3v18h18M7.5 16.5v-6M12 16.5v-9M16.5 16.5v-3',
  CheckIcon: 'm4.5 12.75 6 6 9-13.5',
  ChevronRightIcon: 'm8.25 4.5 7.5 7.5-7.5 7.5',
  ClockIcon: 'M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  Cog6ToothIcon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.28c.063.374.313.69.662.839l1.18.488c.35.145.75.098 1.06-.118l1.063-.744a1.125 1.125 0 0 1 1.45.12l1.833 1.833c.389.389.44 1.003.12 1.45l-.744 1.064c-.217.31-.263.709-.118 1.059l.488 1.18c.149.349.465.599.839.662l1.28.213c.542.09.94.56.94 1.11v2.593c0 .55-.398 1.02-.94 1.11l-1.28.213c-.374.063-.69.313-.839.662l-.488 1.18c-.145.35-.099.75.118 1.06l.744 1.063c.32.447.269 1.061-.12 1.45l-1.833 1.833a1.125 1.125 0 0 1-1.45.12l-1.064-.744a1.125 1.125 0 0 0-1.059-.118l-1.18.488a1.125 1.125 0 0 0-.662.839l-.213 1.28c-.09.542-.56.94-1.11.94h-2.593c-.55 0-1.02-.398-1.11-.94l-.213-1.28a1.125 1.125 0 0 0-.662-.839l-1.18-.488a1.125 1.125 0 0 0-1.06.118l-1.063.744a1.125 1.125 0 0 1-1.45-.12L2.28 19.96a1.125 1.125 0 0 1-.12-1.45l.744-1.064c.217-.31.263-.709.118-1.059l-.488-1.18a1.125 1.125 0 0 0-.839-.662l-1.28-.213A1.125 1.125 0 0 1-.525 13.22v-2.593c0-.55.398-1.02.94-1.11l1.28-.213c.374-.063.69-.313.839-.662l.488-1.18a1.125 1.125 0 0 0-.118-1.06L2.16 5.34a1.125 1.125 0 0 1 .12-1.45l1.833-1.833a1.125 1.125 0 0 1 1.45-.12l1.064.744c.31.217.709.263 1.059.118l1.18-.488c.349-.149.599-.465.662-.839Z M12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z',
  DocumentTextIcon: 'M19.5 14.25v-7.5L14.25 1.5H6A1.5 1.5 0 0 0 4.5 3v18A1.5 1.5 0 0 0 6 22.5h12A1.5 1.5 0 0 0 19.5 21v-6.75ZM14.25 1.5v5.25h5.25M8.25 12h7.5M8.25 15h7.5M8.25 18h4.5',
  EyeIcon: 'M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Zm9.75 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  EyeSlashIcon: 'M3 3l18 18M10.5 5.4A10.4 10.4 0 0 1 12 5.25c6 0 9.75 6.75 9.75 6.75a16.4 16.4 0 0 1-3.1 3.86M6.3 6.75A16.3 16.3 0 0 0 2.25 12S6 18.75 12 18.75c1.2 0 2.32-.27 3.34-.72',
  HomeIcon: 'M2.25 12 12 3l9.75 9M4.5 10.5v10.125c0 .621.504 1.125 1.125 1.125H9.75V15h4.5v6.75h4.125c.621 0 1.125-.504 1.125-1.125V10.5',
  LockClosedIcon: 'M16.5 10.5V7.5a4.5 4.5 0 0 0-9 0v3m-.75 0h10.5A1.5 1.5 0 0 1 18.75 12v7.5A1.5 1.5 0 0 1 17.25 21H6.75a1.5 1.5 0 0 1-1.5-1.5V12a1.5 1.5 0 0 1 1.5-1.5Zm2.25 0V7.5a3 3 0 0 1 6 0v3',
  LockOpenIcon: 'M13.5 10.5V6.75a3.75 3.75 0 1 1 7.5 0M6.75 10.5h10.5a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5H6.75a1.5 1.5 0 0 1-1.5-1.5V12a1.5 1.5 0 0 1 1.5-1.5Z',
  MagnifyingGlassIcon: 'm21 21-5.2-5.2M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z',
  PencilIcon: 'm16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L8.25 18.402 3.75 19.5l1.098-4.5L16.862 4.487Z',
  PlusIcon: 'M12 4.5v15m7.5-7.5h-15',
  PowerIcon: 'M12 2.25v9M6.225 5.811A8.25 8.25 0 1 0 17.775 5.81',
  ShieldCheckIcon: 'M12 2.25 4.5 5.25v5.7c0 4.7 3.1 9.1 7.5 10.8 4.4-1.7 7.5-6.1 7.5-10.8v-5.7L12 2.25Zm-3 10.5 2.25 2.25L15.75 9',
  TrashIcon: 'M6 7.5h12M9 7.5v12m6-12v12M9.75 7.5l.75-3h3l.75 3M6.75 7.5l.75 13.5h9l.75-13.5',
  UserCircleIcon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm-5.25 7.125a6 6 0 0 1 10.5 0',
  UserGroupIcon: 'M17.25 21a5.25 5.25 0 0 0-10.5 0M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm7.5 9a3.75 3.75 0 0 0-3.1-3.69M4.5 21a3.75 3.75 0 0 1 3.1-3.69',
  UsersIcon: 'M15 19.5a6 6 0 0 0-12 0M9 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm12 7.5a4.5 4.5 0 0 0-6.75-3.9M15.75 3.75a3.75 3.75 0 0 1 0 7.5',
  XMarkIcon: 'M6 18 18 6M6 6l12 12',
};

const createIcon = (name) => {
  const Icon = ({ className = 'w-6 h-6', title, ...props }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      className={className}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path d={iconPaths[name] ?? iconPaths.DocumentTextIcon} />
    </svg>
  );
  Icon.displayName = name;
  return Icon;
};

export const ArrowLeftIcon = createIcon('ArrowLeftIcon');
export const ArrowDownTrayIcon = createIcon('ArrowDownTrayIcon');
export const ArrowRightIcon = createIcon('ArrowRightIcon');
export const ArrowRightOnRectangleIcon = createIcon('ArrowRightOnRectangleIcon');
export const ArrowPathIcon = createIcon('ArrowPathIcon');
export const ArrowTrendingUpIcon = createIcon('ArrowTrendingUpIcon');
export const ArchiveBoxArrowDownIcon = createIcon('ArchiveBoxArrowDownIcon');
export const BanknotesIcon = createIcon('BanknotesIcon');
export const BellIcon = createIcon('BellIcon');
export const BuildingOfficeIcon = createIcon('BuildingOfficeIcon');
export const CalendarDaysIcon = createIcon('CalendarDaysIcon');
export const ChartBarIcon = createIcon('ChartBarIcon');
export const CheckIcon = createIcon('CheckIcon');
export const ChevronRightIcon = createIcon('ChevronRightIcon');
export const ClockIcon = createIcon('ClockIcon');
export const Cog6ToothIcon = createIcon('Cog6ToothIcon');
export const DocumentTextIcon = createIcon('DocumentTextIcon');
export const EyeIcon = createIcon('EyeIcon');
export const EyeSlashIcon = createIcon('EyeSlashIcon');
export const HomeIcon = createIcon('HomeIcon');
export const LockClosedIcon = createIcon('LockClosedIcon');
export const LockOpenIcon = createIcon('LockOpenIcon');
export const MagnifyingGlassIcon = createIcon('MagnifyingGlassIcon');
export const PencilIcon = createIcon('PencilIcon');
export const PlusIcon = createIcon('PlusIcon');
export const PowerIcon = createIcon('PowerIcon');
export const ShieldCheckIcon = createIcon('ShieldCheckIcon');
export const TrashIcon = createIcon('TrashIcon');
export const UserCircleIcon = createIcon('UserCircleIcon');
export const UserGroupIcon = createIcon('UserGroupIcon');
export const UsersIcon = createIcon('UsersIcon');
export const XMarkIcon = createIcon('XMarkIcon');
