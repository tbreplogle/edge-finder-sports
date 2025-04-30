
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function Contact() {
  const { toast } = useToast();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would send the form data to a server
    toast({
      title: "Message sent",
      description: "Thank you for your message. We'll get back to you soon.",
    });
  };

  return (
    <AppLayout>
      <div className="container py-8 md:py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">Contact Us</h1>
          
          <p className="text-lg mb-8">
            Have a question or need assistance? Fill out the form below and our team will get back to you as soon as possible.
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-medium">First Name</label>
                <Input id="firstName" placeholder="Enter your first name" />
              </div>
              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm font-medium">Last Name</label>
                <Input id="lastName" placeholder="Enter your last name" />
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input id="email" type="email" placeholder="Enter your email" />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="subject" className="text-sm font-medium">Subject</label>
              <Input id="subject" placeholder="Enter subject" />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="message" className="text-sm font-medium">Message</label>
              <Textarea 
                id="message" 
                placeholder="Enter your message" 
                className="min-h-[150px]"
              />
            </div>
            
            <Button type="submit" className="w-full sm:w-auto">Send Message</Button>
          </form>
          
          <div className="mt-12 pt-8 border-t border-border">
            <h2 className="text-xl font-bold mb-4">Other Ways to Reach Us</h2>
            
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="font-semibold mb-2">Email</h3>
                <p className="text-muted-foreground">support@playedge.com</p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Office</h3>
                <address className="not-italic text-muted-foreground">
                  <p>123 Sports Way, Suite 500</p>
                  <p>Las Vegas, NV 89109</p>
                </address>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
