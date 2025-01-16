import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useAdminStore } from '@/stores/useAdminStore';
import { XAutomationMode } from '@prisma/client';
import toast from 'react-hot-toast';

interface XAutomationSettingsProps {
  currentMode: XAutomationMode;
  lastCheck: Date | null;
  onModeChange: (mode: XAutomationMode) => Promise<void>;
  onCheckMentions: () => Promise<void>;
}

export function XAutomationSettings({
  currentMode,
  lastCheck,
  onModeChange,
  onCheckMentions,
}: XAutomationSettingsProps) {
  const { isLoading } = useAdminStore();

  const handleModeToggle = async () => {
    try {
      const newMode = currentMode === 'AUTOMATIC' ? 'SEMI_AUTOMATIC' : 'AUTOMATIC';
      await onModeChange(newMode);
      toast.success(`X automation mode set to ${newMode.toLowerCase().replace('_', '-')}`);
    } catch (error) {
      console.error('Error changing automation mode:', error);
      toast.error('Failed to change automation mode');
    }
  };

  const handleCheckMentions = async () => {
    try {
      await onCheckMentions();
      toast.success('Successfully checked for new mentions');
    } catch (error) {
      console.error('Error checking mentions:', error);
      toast.error('Failed to check mentions');
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">X Automation Settings</h3>
          <p className="text-sm text-muted-foreground">
            Control how Amariel interacts with X
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">
            {currentMode === 'AUTOMATIC' ? 'Automatic' : 'Semi-automatic'}
          </span>
          <Switch
            checked={currentMode === 'AUTOMATIC'}
            onCheckedChange={handleModeToggle}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-sm font-medium">Last Mention Check</h4>
            <p className="text-xs text-muted-foreground">
              {lastCheck
                ? new Date(lastCheck).toLocaleString()
                : 'Never checked'}
            </p>
          </div>
          <Button
            onClick={handleCheckMentions}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            Check Now
          </Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>
          {currentMode === 'AUTOMATIC'
            ? 'Amariel will automatically respond to mentions and generate thoughts.'
            : 'Amariel will wait for your approval before posting responses.'}
        </p>
      </div>
    </Card>
  );
} 