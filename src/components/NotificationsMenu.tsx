
import { Bell } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface NotificationsMenuProps {
  alerts: any[];
  hasNewAlerts: boolean;
}

export function NotificationsMenu({ alerts, hasNewAlerts }: NotificationsMenuProps) {
  const { toast } = useToast();
  
  const markAlertsAsRead = () => {
    // In a real app, you would also update the database
    toast({
      title: "Alerts marked as read",
      description: "All notifications have been marked as read"
    });
  };
  
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {hasNewAlerts && <span className="absolute top-1 right-1 w-2 h-2 bg-edge-accent rounded-full"></span>}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex justify-between items-center">
            Notifications
            <Button variant="ghost" size="sm" onClick={markAlertsAsRead}>
              Mark all as read
            </Button>
          </AlertDialogTitle>
          <AlertDialogDescription>
            {alerts.length > 0 ? (
              <div className="max-h-[300px] overflow-auto">
                {alerts.map(alert => (
                  <div key={alert.id} className={`alert-notification-item ${!alert.isRead ? 'unread' : ''}`}>
                    <div className="flex justify-between">
                      <span className={`alert-badge ${alert.type}`}>
                        {alert.type === 'edge' ? 'Edge Alert' : 'System'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(alert.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">{alert.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center">No notifications to display</p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
