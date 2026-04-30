import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DASHBOARD_HOME_SECTION_DEFINITIONS,
  DASHBOARD_PRESET_OPTIONS,
  DASHBOARD_TAB_DEFINITIONS,
  sortDashboardItems,
  type DashboardConfig,
  type DashboardHomeSectionId,
  type DashboardPresetId,
  type DashboardTabId,
} from '@/lib/dashboard-config';

type DashboardCustomizationModalProps = {
  isOpen: boolean;
  config: DashboardConfig;
  onClose: () => void;
  onMoveTab: (activeId: DashboardTabId, overId: DashboardTabId) => void;
  onMoveHomeSection: (activeId: DashboardHomeSectionId, overId: DashboardHomeSectionId) => void;
  onToggleTabVisibility: (id: DashboardTabId, visible: boolean) => void;
  onToggleHomeSectionVisibility: (id: DashboardHomeSectionId, visible: boolean) => void;
  onApplyPreset: (presetId: DashboardPresetId) => void;
  onReset: () => void;
};

type SortableVisibilityItemProps = {
  id: string;
  title: string;
  description: string;
  visible: boolean;
  canToggle: boolean;
  fixedLabel?: string;
  onToggle: (visible: boolean) => void;
};

function SortableVisibilityItem({
  id,
  title,
  description,
  visible,
  canToggle,
  fixedLabel,
  onToggle,
}: SortableVisibilityItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`rounded-2xl border border-c-border bg-c-surface p-4 shadow-sm ${isDragging ? 'opacity-80' : ''}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-1 cursor-grab rounded-lg border border-c-border bg-c-surface-2 px-2 py-1 text-xs text-c-text-2 active:cursor-grabbing"
          aria-label={`${title} 순서 이동`}
          {...attributes}
          {...listeners}
        >
          ≡
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-c-text">{title}</p>
            {fixedLabel ? (
              <span className="rounded-full bg-c-surface-2 px-2 py-0.5 text-[11px] font-medium text-c-text-2">
                {fixedLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-c-text-2">{description}</p>
        </div>
        <label className={`flex items-center gap-2 text-sm ${canToggle ? 'text-c-text' : 'text-c-text-3'}`}>
          <input
            type="checkbox"
            checked={visible}
            disabled={!canToggle}
            onChange={(event) => onToggle(event.target.checked)}
            className="h-4 w-4 rounded border-c-border text-c-accent focus:ring-c-accent"
          />
          표시
        </label>
      </div>
    </li>
  );
}

export function DashboardCustomizationModal({
  isOpen,
  config,
  onClose,
  onMoveTab,
  onMoveHomeSection,
  onToggleTabVisibility,
  onToggleHomeSectionVisibility,
  onApplyPreset,
  onReset,
}: DashboardCustomizationModalProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!isOpen) return null;

  const sortedTabs = sortDashboardItems(config.tabs);
  const sortedHomeSections = sortDashboardItems(config.homeSections);
  const tabDefinitionMap = new Map(DASHBOARD_TAB_DEFINITIONS.map((definition) => [definition.id, definition]));
  const homeDefinitionMap = new Map(DASHBOARD_HOME_SECTION_DEFINITIONS.map((definition) => [definition.id, definition]));

  const handleTabDragEnd = (event: DragEndEvent) => {
    const activeId = event.active.id as DashboardTabId;
    const overId = event.over?.id as DashboardTabId | undefined;
    if (!overId) return;
    onMoveTab(activeId, overId);
  };

  const handleHomeSectionDragEnd = (event: DragEndEvent) => {
    const activeId = event.active.id as DashboardHomeSectionId;
    const overId = event.over?.id as DashboardHomeSectionId | undefined;
    if (!overId) return;
    onMoveHomeSection(activeId, overId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-6 backdrop-blur-sm sm:px-6">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[28px] border border-c-border bg-c-bg shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-c-border bg-c-surface px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-xl font-bold text-c-text">대시보드 편집</h2>
            <p className="mt-1 text-sm text-c-text-2">탭 순서, 홈 레이아웃, 프리셋을 바로 바꾸고 저장합니다.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-c-border bg-c-surface-2 px-3 py-2 text-sm text-c-text-2 hover:bg-c-surface"
          >
            닫기
          </button>
        </div>

        <div className="max-h-[calc(90vh-76px)] overflow-y-auto px-5 py-5 sm:px-6">
          <section className="rounded-2xl border border-c-border bg-c-surface p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-c-text">프리셋</h3>
                <p className="mt-1 text-sm text-c-text-2">프리셋을 누르면 탭 순서와 홈 섹션 구성이 함께 적용됩니다.</p>
              </div>
              <button
                type="button"
                onClick={onReset}
                className="rounded-lg border border-c-border bg-c-surface-2 px-3 py-2 text-sm text-c-text-2 hover:bg-c-surface"
              >
                기본값 초기화
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {DASHBOARD_PRESET_OPTIONS.map((preset) => {
                const active = config.appliedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onApplyPreset(preset.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? 'border-c-accent bg-c-accent-bg'
                        : 'border-c-border bg-c-surface-2 hover:bg-c-surface'
                    }`}
                  >
                    <p className="font-semibold text-c-text">{preset.label}</p>
                    <p className="mt-1 text-sm text-c-text-2">{preset.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <section className="rounded-2xl border border-c-border bg-c-surface p-5">
              <h3 className="font-bold text-c-text">상단 탭</h3>
              <p className="mt-1 text-sm text-c-text-2">드래그로 순서를 바꾸고, 핵심 탭 외에는 숨길 수 있습니다.</p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTabDragEnd}>
                <SortableContext items={sortedTabs.map((tab) => tab.id)} strategy={verticalListSortingStrategy}>
                  <ul className="mt-4 space-y-3">
                    {sortedTabs.map((tab) => {
                      const definition = tabDefinitionMap.get(tab.id);
                      const fixedLabel = definition?.lockedFirst
                        ? '첫 탭 고정'
                        : definition?.fixedVisibility
                          ? '항상 표시'
                          : undefined;

                      return (
                        <SortableVisibilityItem
                          key={tab.id}
                          id={tab.id}
                          title={definition?.label ?? tab.id}
                          description={definition?.description ?? ''}
                          visible={tab.visible}
                          canToggle={!definition?.fixedVisibility}
                          fixedLabel={fixedLabel}
                          onToggle={(visible) => onToggleTabVisibility(tab.id, visible)}
                        />
                      );
                    })}
                  </ul>
                </SortableContext>
              </DndContext>
            </section>

            <section className="rounded-2xl border border-c-border bg-c-surface p-5">
              <h3 className="font-bold text-c-text">홈 섹션</h3>
              <p className="mt-1 text-sm text-c-text-2">홈 탭에서 보이는 카드들의 순서와 표시 여부를 바꿉니다.</p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleHomeSectionDragEnd}>
                <SortableContext items={sortedHomeSections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
                  <ul className="mt-4 space-y-3">
                    {sortedHomeSections.map((section) => {
                      const definition = homeDefinitionMap.get(section.id);
                      return (
                        <SortableVisibilityItem
                          key={section.id}
                          id={section.id}
                          title={definition?.label ?? section.id}
                          description={definition?.description ?? ''}
                          visible={section.visible}
                          canToggle={true}
                          onToggle={(visible) => onToggleHomeSectionVisibility(section.id, visible)}
                        />
                      );
                    })}
                  </ul>
                </SortableContext>
              </DndContext>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
