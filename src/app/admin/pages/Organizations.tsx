import { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Users,
  Calendar,
  Plus,
  Edit,
  Eye,
  Archive,
  ArchiveRestore,
  Clock,
  Search,
  CalendarCheck,
} from "lucide-react";
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { CreateClubModal, useOrgMemberCountsStream } from '../../modules/organizations';
import type { OrganizationDocument } from '../../modules/organizations/types/organization.types';
import { useAdviserProfile } from '../../modules/auth';

import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useOrganizationTypes } from '../../modules/organizations/hooks/useOrganizationTypes';
import { useAllEvents } from '../../modules/events/hooks/useEventStream';
import { OrganizationDetailModal } from '../components/OrganizationDetailModal';
import { EditOrganizationModal } from '../components/EditOrganizationModal';
import { OrganizationStatusModal } from '../components/OrganizationStatusModal';
import { TablePagination } from '../../components/common/TablePagination';

export function Organizations() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationDocument | null>(null);
  const [activeModal, setActiveModal] = useState<'detail' | 'edit' | 'status' | null>(null);
  const [statusMode, setStatusMode] = useState<'archive' | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 8;

  const { profile } = useAdviserProfile();
  
  // Real Firestore Streams
  const { data: rawOrganizations = [], loading: loadingOrgs } = useOrganizationStream();
  const { countsMap = {}, loading: loadingCounts } = useOrgMemberCountsStream();
  const { data: orgTypes = [] } = useOrganizationTypes();
  const { events = [], loading: loadingEvents } = useAllEvents();

  // Real-time Pending Member Applications Stream across all organizations
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState<number>(0);
  const [loadingPendingApps, setLoadingPendingApps] = useState(true);

  useEffect(() => {
    const qPending = query(
      collection(db, 'organization_members'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(
      qPending,
      (snapshot) => {
        setPendingApplicationsCount(snapshot.size);
        setLoadingPendingApps(false);
      },
      (err) => {
        console.error('Error streaming pending applications count:', err);
        setLoadingPendingApps(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const loading = loadingOrgs || loadingCounts || loadingEvents || loadingPendingApps;

  // Real Event counts mapped per organization from Firestore
  const orgEventsStats = useMemo(() => {
    const totalMap: Record<string, number> = {};
    const approvedMap: Record<string, number> = {};

    events.forEach((evt) => {
      const orgId = evt.hostingOrgId || evt.organizationId || evt.organizerId;
      if (orgId) {
        totalMap[orgId] = (totalMap[orgId] || 0) + 1;
        if (
          evt.proposalStatus === 'approved' ||
          evt.status === 'approved' ||
          evt.status === 'ongoing' ||
          evt.status === 'completed'
        ) {
          approvedMap[orgId] = (approvedMap[orgId] || 0) + 1;
        }
      }
    });
    return { totalMap, approvedMap };
  }, [events]);

  // Merge live member counts
  const organizations = useMemo(() => {
    return rawOrganizations.map((org) => ({
      ...org,
      memberCount: countsMap[org.id] ?? org.memberCount ?? 0,
    }));
  }, [rawOrganizations, countsMap]);

  // Real computed summary metrics
  const activeOrgsCount = useMemo(
    () => organizations.filter((o) => o.status === 'active').length,
    [organizations]
  );

  const archivedOrgsCount = useMemo(
    () => organizations.filter((o) => o.status === 'archived').length,
    [organizations]
  );
  
  const totalMembersCount = useMemo(
    () => organizations.reduce((acc, org) => acc + (Number(org.memberCount) || 0), 0),
    [organizations]
  );

  const activeEventsCount = useMemo(() => {
    return events.filter(
      (e) =>
        e.proposalStatus === 'approved' ||
        e.status === 'approved' ||
        e.status === 'ongoing' ||
        e.status === 'published'
    ).length;
  }, [events]);

  // Filtered organizations list
  const filteredOrganizations = useMemo(() => {
    return organizations.filter((org) => {
      const q = (searchQuery || '').trim().toLowerCase();
      const nameMatch = (org.name || '').toLowerCase().includes(q);
      const acronymMatch = (org.acronym || '').toLowerCase().includes(q);
      const deptMatch = (org.department || '').toLowerCase().includes(q);
      const matchesSearch = !q || nameMatch || acronymMatch || deptMatch;

      const matchesType = filterType === 'All' || org.typeId === filterType;
      
      let matchesTab = true;
      if (activeTab === 'active') {
        matchesTab = org.status === 'active';
      } else if (activeTab === 'archived') {
        matchesTab = org.status === 'archived';
      }

      return matchesSearch && matchesType && matchesTab;
    });
  }, [organizations, searchQuery, filterType, activeTab]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filteredOrganizations.length / PER_PAGE));
  const paginatedOrganizations = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return filteredOrganizations.slice(start, start + PER_PAGE);
  }, [filteredOrganizations, currentPage]);

  const getOrgType = (typeId: string) => orgTypes.find((t) => t.id === typeId);

  const handleOpenDetail = (org: OrganizationDocument) => {
    setSelectedOrg(org);
    setActiveModal('detail');
  };

  const handleOpenEdit = (org: OrganizationDocument) => {
    setSelectedOrg(org);
    setActiveModal('edit');
  };

  const handleOpenStatus = (org: OrganizationDocument, mode: 'archive') => {
    setSelectedOrg(org);
    setStatusMode(mode);
    setActiveModal('status');
  };

  const handleCloseModals = () => {
    setActiveModal(null);
    setSelectedOrg(null);
    setStatusMode(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Organization Management</h2>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#001A4D] hover:bg-[#0E4EBD] text-white shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-2 text-[#FFC107]" />
          Create Organization
        </Button>
      </div>

      {isModalOpen && (
        <CreateClubModal
          createdBy={
            profile?.displayName ||
            (profile?.firstName ? `${profile.firstName} ${profile.lastName}`.trim() : profile?.uid) ||
            'SAS Administrator'
          }
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => setIsModalOpen(false)}
          isOpen={isModalOpen}
        />
      )}

      {/* Action Modals */}
      <OrganizationDetailModal
        organization={selectedOrg}
        isOpen={activeModal === 'detail'}
        onClose={handleCloseModals}
      />

      <EditOrganizationModal
        organization={selectedOrg}
        isOpen={activeModal === 'edit'}
        onClose={handleCloseModals}
      />

      <OrganizationStatusModal
        organization={selectedOrg}
        mode={statusMode}
        isOpen={activeModal === 'status'}
        onClose={handleCloseModals}
      />

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border-[#E0E0E0] shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>Total Organizations</span>
              <Building2 className="w-4 h-4 text-[#001A4D]" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-[#001A4D]">{organizations.length}</div>
            <p className="text-xs text-gray-500 mt-1">
              <span className="text-green-600 font-semibold">{activeOrgsCount}</span> active / recognized
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#E0E0E0] shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>Total Members</span>
              <Users className="w-4 h-4 text-[#0E4EBD]" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-[#0E4EBD]">
              {totalMembersCount.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">Across all registered student bodies</p>
          </CardContent>
        </Card>

        <Card className="border-[#E0E0E0] shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>Active Events</span>
              <CalendarCheck className="w-4 h-4 text-[#0E4EBD]" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-[#0E4EBD]">{activeEventsCount}</div>
            <p className="text-xs text-gray-500 mt-1">
              Approved / scheduled campus activities
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#E0E0E0] shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>Pending Applications</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-amber-600">
              {pendingApplicationsCount}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Student applicants awaiting club approval
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Organizations Table Card */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden shadow-xs">
        {/* Section Header & Sub-Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-gray-100 gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="border-l-4 border-[#0E4EBD] pl-3">
              <h3 className="text-[#001A4D] font-bold text-base">Student Organizations</h3>
            </div>
            <div className="flex gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'all'
                    ? 'bg-[#001A4D] text-[#FFD41C] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>All Organizations</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
                  {organizations.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'active'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>Active</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                  {activeOrgsCount}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('archived')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'archived'
                    ? 'bg-gray-700 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>Archived</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'archived' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
                  {archivedOrgsCount}
                </span>
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-[#E0E0E0] rounded-lg text-xs focus:border-[#1E70E8] focus:ring-2 focus:ring-[#1E70E8]/20 outline-none"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 border border-[#E0E0E0] rounded-lg text-xs text-[#001A4D] bg-white outline-none cursor-pointer"
            >
              <option value="All">All Types</option>
              {orgTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            <div className="w-8 h-8 border-3 border-[#0E4EBD] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading organizations...
          </div>
        ) : filteredOrganizations.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="font-bold text-gray-700 text-sm">No organizations found.</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {searchQuery || filterType !== 'All'
                ? 'Try adjusting your search or filters.'
                : 'Click "Create Organization" to register a new student club.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    Organization
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    Category / Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    Department
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    Adviser
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    Members
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    Events
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {paginatedOrganizations.map((org) => {
                  const orgType = getOrgType(org.typeId);
                  const isArchived = org.status === 'archived';
                  const totalEvents = orgEventsStats.totalMap[org.id] || 0;

                  return (
                    <tr
                      key={org.id}
                      className="hover:bg-gray-50/80 transition-colors"
                    >
                      {/* Organization Name & Avatar */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-xl flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden flex-shrink-0 shadow-2xs border border-gray-100">
                            {org.logoUrl ? (
                              <img src={org.logoUrl} alt={org.name} className="w-full h-full object-cover" />
                            ) : (
                              org.acronym || org.name?.slice(0, 3) || 'ORG'
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-[#001A4D] text-sm truncate max-w-[220px]" title={org.name}>
                              {org.name}
                            </p>
                            <span className="text-xs text-gray-400 font-mono font-semibold">
                              ({org.acronym || 'ORG'})
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="px-4 py-3.5">
                        <Badge className="bg-[#FFD54F]/30 text-[#001A4D] hover:bg-[#FFD54F]/40 font-bold text-[11px] border-0 px-2 py-0.5 rounded-md whitespace-nowrap">
                          {orgType?.name || 'Student Org'}
                        </Badge>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3.5 text-xs text-gray-700 font-medium whitespace-nowrap">
                        {org.department || '—'}
                      </td>

                      {/* Adviser */}
                      <td className="px-4 py-3.5 text-xs text-gray-700 whitespace-nowrap">
                        {org.adviser?.name ? (
                          <span className="font-semibold text-gray-800">{org.adviser.name}</span>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Members */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
                          <Users className="w-3.5 h-3.5 text-[#0E4EBD]" />
                          <span>{org.memberCount || 0}</span>
                        </div>
                      </td>

                      {/* Events */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-[#0E4EBD]" />
                          <span>{totalEvents} {totalEvents === 1 ? 'event' : 'events'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] tracking-wider whitespace-nowrap ${
                            org.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {org.status}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDetail(org)}
                            className="p-1.5 h-8 w-8 hover:bg-blue-50 text-blue-600 rounded-lg cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(org)}
                            className="p-1.5 h-8 w-8 hover:bg-blue-50 text-[#1E70E8] rounded-lg cursor-pointer"
                            title="Edit Organization"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenStatus(org, 'archive')}
                            className={`p-1.5 h-8 w-8 rounded-lg cursor-pointer ${
                              isArchived ? 'hover:bg-blue-50 text-blue-600' : 'hover:bg-gray-200 text-gray-500'
                            }`}
                            title={isArchived ? 'Unarchive Organization' : 'Archive Organization'}
                          >
                            {isArchived ? (
                              <ArchiveRestore className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Archive className="w-4 h-4 text-gray-500" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Standard Table Pagination */}
        {!loading && filteredOrganizations.length > 0 && (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredOrganizations.length}
            itemsPerPage={PER_PAGE}
            onPageChange={setCurrentPage}
            itemName="organizations"
          />
        )}
      </div>
    </div>
  );
}

