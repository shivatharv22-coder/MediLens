'use client';

import { useState } from 'react';
import { usePreferences } from '@/components/preferences-provider';
import { LanguageList } from '@/components/layout/language-switcher';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeading } from '@/components/ui/card';
import { Toggle } from '@/components/ui/form';
import { clearScanResults } from '@/features/scan/scan-storage';
import { useDict } from '@/lib/i18n/client';

export function SettingsClient() {
  const dict = useDict();
  const { preferences, update, clearLocalData } = usePreferences();
  const [cleared, setCleared] = useState(false);

  return (
    <div className="space-y-5">
      <PageHeader title={dict.settings.title} />

      <Card as="section">
        <CardHeading>{dict.settings.language}</CardHeading>
        <p className="mb-3 text-sm text-ink-600">{dict.settings.languageHelp}</p>
        <LanguageList />
      </Card>

      <Card as="section">
        <CardHeading>{dict.settings.accessibility}</CardHeading>
        <div className="divide-y divide-[var(--border)]">
          <Toggle
            label={dict.settings.highContrast}
            checked={preferences.highContrast}
            onChange={(v) => update({ highContrast: v })}
          />
          <Toggle
            label={dict.settings.largeText}
            checked={preferences.largeText}
            onChange={(v) => update({ largeText: v })}
          />
        </div>
      </Card>

      <Card as="section">
        <CardHeading>{dict.settings.speech}</CardHeading>
        <div className="divide-y divide-[var(--border)]">
          <Toggle
            label={dict.settings.ttsEnabled}
            checked={preferences.ttsEnabled}
            onChange={(v) => update({ ttsEnabled: v })}
          />
          <div className="py-3">
            <label htmlFor="tts-rate" className="text-sm font-medium text-ink-900">
              {dict.settings.ttsRate}
            </label>
            <input
              id="tts-rate"
              type="range"
              min={0.6}
              max={1.6}
              step={0.1}
              value={preferences.ttsRate}
              onChange={(e) => update({ ttsRate: Number(e.target.value) })}
              className="mt-2 w-full accent-[var(--color-brand-600)]"
              aria-valuetext={`${preferences.ttsRate.toFixed(1)}x`}
            />
            <p className="text-xs text-ink-500">{preferences.ttsRate.toFixed(1)}×</p>
          </div>
        </div>
      </Card>

      <Card as="section">
        <CardHeading>{dict.settings.privacy}</CardHeading>
        <div className="divide-y divide-[var(--border)]">
          <Toggle
            label={dict.settings.saveScanImages}
            hint={dict.settings.saveScanImagesHelp}
            checked={preferences.saveScanImages}
            onChange={(v) => update({ saveScanImages: v })}
          />
        </div>
      </Card>

      <Card as="section">
        <CardHeading>{dict.settings.dataTitle}</CardHeading>
        {cleared && (
          <Alert tone="success" className="mb-3" role="status">
            {dict.history.cleared}
          </Alert>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            clearScanResults();
            clearLocalData();
            setCleared(true);
          }}
        >
          {dict.settings.clearLocalData}
        </Button>
      </Card>
    </div>
  );
}
