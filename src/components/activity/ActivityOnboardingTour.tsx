'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ACTIONS, EVENTS, Joyride, STATUS, type EventData, type Step } from 'react-joyride'
import { useTranslations } from '@/i18n/hooks'
import {
  ACTIVITY_TOUR_LAUNCH_ARM_EVENT,
  ACTIVITY_TOUR_LAUNCH_DISARM_EVENT,
  ACTIVITY_TOUR_START_EVENT,
  getActivityTourStatus,
  isActivityTourPending,
  setActivityTourPending,
  setActivityTourStatus,
} from '@/lib/activity-tour/storage'

type ActivityOnboardingTourProps = {
  userId?: string | null
  isNewActivityDialogOpen: boolean
  selectedActivityType?: string
  rattingConfigInteractionCount: number
  selectedParticipantCount: number
  activeActivityCount: number
  hasTourCreatedActivity: boolean
  isRattingConfigurationReady: boolean
  onResetTourCreatedActivity: () => void
  onRequestOpenNewActivityDialog: () => void
  onRequestCloseNewActivityDialog: () => void
  onRequestClearOverlaysForCardStep: () => void
}

const ACTIVE_CARD_STEP_INDEX = 5

export function ActivityOnboardingTour({
  userId,
  isNewActivityDialogOpen,
  selectedActivityType,
  rattingConfigInteractionCount,
  selectedParticipantCount,
  activeActivityCount,
  hasTourCreatedActivity,
  isRattingConfigurationReady,
  onResetTourCreatedActivity,
  onRequestOpenNewActivityDialog,
  onRequestCloseNewActivityDialog,
  onRequestClearOverlaysForCardStep,
}: ActivityOnboardingTourProps) {
  const { t } = useTranslations()
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [didClickStart, setDidClickStart] = useState(false)
  const [didClickRatting, setDidClickRatting] = useState(false)
  const [didTouchFleetSelection, setDidTouchFleetSelection] = useState(false)
  const [didClickLaunch, setDidClickLaunch] = useState(false)
  const [step2InteractionBaseline, setStep2InteractionBaseline] = useState<number | null>(null)
  const hasStep2Interaction =
    step2InteractionBaseline !== null && rattingConfigInteractionCount > step2InteractionBaseline

  const steps = useMemo<Step[]>(
    () => [
      {
        target: '[data-tour="start-new-activity"]',
        title: t('activity.tour.stepStartTitle'),
        content: t('activity.tour.stepStartDescription'),
        disableBeacon: true,
        buttons: ['skip'],
      },
      {
        target: '[data-tour="activity-type-ratting"]',
        title: t('activity.tour.stepTypeTitle'),
        content: t('activity.tour.stepTypeDescription'),
        buttons: ['skip'],
      },
      {
        target: '[data-tour="ratting-config"]',
        title: t('activity.tour.stepConfigTitle'),
        content: t('activity.tour.stepConfigDescription'),
        buttons: ['skip'],
      },
      {
        target: '[data-tour="fleet-deployment"]',
        title: t('activity.tour.stepFleetTitle'),
        content: t('activity.tour.stepFleetDescription'),
        buttons: ['skip'],
      },
      {
        target: '[data-tour="launch-fleet-operations"]',
        title: t('activity.tour.stepLaunchTitle'),
        content: t('activity.tour.stepLaunchDescription'),
        buttons: ['skip'],
      },
      {
        target: '[data-tour="active-activity-card"]',
        title: t('activity.tour.stepCardTitle'),
        content: t('activity.tour.stepCardDescription'),
        buttons: ['skip', 'primary'],
      },
    ],
    [t]
  )

  const startTour = useCallback(
    (forceRestart: boolean) => {
      if (!userId) return
      if (!forceRestart && getActivityTourStatus(userId) !== 'never_seen') return

      setActivityTourPending(false, userId)
      setDidClickStart(false)
      setDidClickRatting(false)
      setDidTouchFleetSelection(false)
      setDidClickLaunch(false)
      setStep2InteractionBaseline(null)
      onResetTourCreatedActivity()
      window.dispatchEvent(new Event(ACTIVITY_TOUR_LAUNCH_DISARM_EVENT))
      setStepIndex(0)
      onRequestCloseNewActivityDialog()
      setRun(true)
    },
    [onRequestCloseNewActivityDialog, onResetTourCreatedActivity, userId]
  )

  useEffect(() => {
    if (!userId) return
    if (!isActivityTourPending(userId)) return
    startTour(false)
  }, [startTour, userId])

  useEffect(() => {
    const onStart = () => startTour(true)
    window.addEventListener(ACTIVITY_TOUR_START_EVENT, onStart)
    return () => window.removeEventListener(ACTIVITY_TOUR_START_EVENT, onStart)
  }, [startTour])

  useEffect(() => {
    if (stepIndex === 2) {
      setStep2InteractionBaseline((prev) =>
        prev === null ? rattingConfigInteractionCount : prev
      )
      return
    }

    setStep2InteractionBaseline(null)
  }, [rattingConfigInteractionCount, stepIndex])

  useEffect(() => {
    if (!run) return

    const onGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      if (stepIndex === 0 && target.closest('[data-tour="start-new-activity"]')) {
        setDidClickStart(true)
        return
      }

      if (stepIndex === 1 && target.closest('[data-tour="activity-type-ratting"]')) {
        setDidClickRatting(true)
        return
      }

      if (stepIndex === 3 && target.closest('[data-tour="fleet-participant-toggle"]')) {
        setDidTouchFleetSelection(true)
        return
      }

      if (stepIndex === 4 && target.closest('[data-tour="launch-fleet-operations"]')) {
        setDidClickLaunch(true)
        window.dispatchEvent(new Event(ACTIVITY_TOUR_LAUNCH_ARM_EVENT))
      }
    }

    document.addEventListener('click', onGlobalClick, true)

    return () => {
      document.removeEventListener('click', onGlobalClick, true)
    }
  }, [run, stepIndex])

  useEffect(() => {
    if (!run) return

    if (stepIndex === 0 && didClickStart && isNewActivityDialogOpen) {
      setStepIndex(1)
      return
    }

    if (stepIndex === 1 && didClickRatting && selectedActivityType === 'ratting') {
      setStepIndex(2)
      return
    }

    if (stepIndex === 2 && hasStep2Interaction && isRattingConfigurationReady) {
      setStepIndex(3)
      return
    }

    if (stepIndex === 3 && didTouchFleetSelection && selectedParticipantCount > 0) {
      setStepIndex(4)
      return
    }

    if (stepIndex === 4 && didClickLaunch && !isNewActivityDialogOpen && hasTourCreatedActivity) {
      setStepIndex(5)
      return
    }

    if (stepIndex === 5) {
      onRequestClearOverlaysForCardStep()
      return
    }

    if (stepIndex >= 1 && stepIndex <= 4 && !isNewActivityDialogOpen) {
      onRequestOpenNewActivityDialog()
    }
  }, [
    activeActivityCount,
    didClickLaunch,
    didClickRatting,
    didClickStart,
    didTouchFleetSelection,
    hasStep2Interaction,
    hasTourCreatedActivity,
    isNewActivityDialogOpen,
    isRattingConfigurationReady,
    onRequestClearOverlaysForCardStep,
    onRequestOpenNewActivityDialog,
    run,
    selectedParticipantCount,
    selectedActivityType,
    stepIndex,
  ])

  const handleCallback = useCallback(
    ({ action, index, status, type }: EventData) => {
      if (!userId) return

      if (status === STATUS.FINISHED) {
        setRun(false)
        setStepIndex(0)
        setActivityTourPending(false, userId)
        setActivityTourStatus('completed', userId)
        window.dispatchEvent(new Event(ACTIVITY_TOUR_LAUNCH_DISARM_EVENT))
        return
      }

      if (status === STATUS.SKIPPED) {
        setRun(false)
        setStepIndex(0)
        setActivityTourPending(false, userId)
        setActivityTourStatus('stopped', userId)
        window.dispatchEvent(new Event(ACTIVITY_TOUR_LAUNCH_DISARM_EVENT))
        return
      }

      if (type === EVENTS.TARGET_NOT_FOUND) {
        if (index === ACTIVE_CARD_STEP_INDEX) {
          onRequestClearOverlaysForCardStep()

          if (!hasTourCreatedActivity) {
            setStepIndex(4)
            return
          }

          // Keep trying this step until the created card anchor is mounted.
          setStepIndex(ACTIVE_CARD_STEP_INDEX)
          return
        }

        if (index > 0 && !isNewActivityDialogOpen) {
          onRequestOpenNewActivityDialog()
          setStepIndex(Math.max(1, index))
          return
        }

        if (index >= 2 && selectedActivityType !== 'ratting') {
          setStepIndex(1)
          return
        }

        setStepIndex(Math.max(0, index))
        return
      }

      if (type === EVENTS.STEP_AFTER) {
        const isPrevAction = action === ACTIONS.PREV
        const nextIndex = Math.max(0, index + (isPrevAction ? -1 : 1))

        if (!isPrevAction) {
          if (index === 0 && !isNewActivityDialogOpen) {
            setStepIndex(0)
            return
          }

          if (index === 1 && selectedActivityType !== 'ratting') {
            setStepIndex(1)
            return
          }

          if (index === 2 && (!hasStep2Interaction || !isRattingConfigurationReady)) {
            setStepIndex(2)
            return
          }

          if (index === 3 && (!didTouchFleetSelection || selectedParticipantCount === 0)) {
            setStepIndex(3)
            return
          }

          if (index === 4 && (!didClickLaunch || isNewActivityDialogOpen || activeActivityCount === 0)) {
            setStepIndex(4)
            return
          }

          if (index === 4 && !hasTourCreatedActivity) {
            setStepIndex(4)
            return
          }
        }

        setStepIndex(nextIndex)
      }
    },
    [
      activeActivityCount,
      didClickLaunch,
      didTouchFleetSelection,
      hasStep2Interaction,
      hasTourCreatedActivity,
      isNewActivityDialogOpen,
      isRattingConfigurationReady,
      onRequestClearOverlaysForCardStep,
      onRequestOpenNewActivityDialog,
      selectedParticipantCount,
      selectedActivityType,
      userId,
    ]
  )

  return (
    <Joyride
      onEvent={handleCallback}
      continuous
      options={{
        backgroundColor: '#111827',
        buttons: ['skip'],
        closeButtonAction: 'skip',
        overlayClickAction: false,
        overlayColor: 'rgba(2, 6, 23, 0.75)',
        primaryColor: '#00e5ff',
        scrollOffset: 96,
        showProgress: true,
        skipBeacon: true,
        targetWaitTimeout: 2000,
        textColor: '#f9fafb',
        zIndex: 100000,
      }}
      styles={{
        tooltip: {
          pointerEvents: 'auto',
          zIndex: 100001,
        },
        tooltipFooter: {
          pointerEvents: 'auto',
        },
      }}
      run={run}
      scrollToFirstStep
      stepIndex={stepIndex}
      steps={steps}
      locale={{
        back: t('activity.tour.back'),
        close: t('activity.tour.close'),
        last: t('activity.tour.finish'),
        next: t('activity.tour.next'),
        open: t('activity.tour.open'),
        skip: t('activity.tour.stop'),
      }}
    />
  )
}
