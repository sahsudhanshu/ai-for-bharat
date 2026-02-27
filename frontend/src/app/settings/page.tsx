"use client"

import React from 'react';
import { 
  User, 
  Shield, 
  Bell, 
  Languages, 
  Globe, 
  Database, 
  HelpCircle, 
  LogOut, 
  Camera, 
  ChevronRight,
  Settings as SettingsIcon,
  CreditCard,
  Smartphone,
  Check
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account, preferences, and security settings.</p>
      </div>

      <div className="space-y-8">
        {/* Profile Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Profile Information</h2>
          </div>
          
          <Card className="rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-8 space-y-8">
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <div className="relative group">
                  <Avatar className="h-24 w-24 border-4 border-primary/10 shadow-xl">
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>RM</AvatarFallback>
                  </Avatar>
                  <Button size="icon" className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary shadow-lg group-hover:scale-110 transition-transform">
                    <Camera className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="text-2xl font-bold">Ram Mohan</h3>
                  <p className="text-muted-foreground font-medium">Professional Fisher • Konkan Region</p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-2">
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-none px-3 py-1 font-bold text-[10px] uppercase">Verified Account</Badge>
                    <Badge className="bg-primary/10 text-primary border-none px-3 py-1 font-bold text-[10px] uppercase">Premium Tier</Badge>
                  </div>
                </div>
                <Button variant="outline" className="sm:ml-auto rounded-xl border-border h-11 font-bold">
                  View Public Profile
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                <div className="space-y-2">
                  <Label htmlFor="full-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Full Name</Label>
                  <Input id="full-name" defaultValue="Ram Mohan" className="h-12 rounded-xl bg-muted/30 border-none px-4 font-medium" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Email Address</Label>
                  <Input id="email" defaultValue="ram.mohan@konkanfisher.in" className="h-12 rounded-xl bg-muted/30 border-none px-4 font-medium" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Phone Number</Label>
                  <Input id="phone" defaultValue="+91 98765 43210" className="h-12 rounded-xl bg-muted/30 border-none px-4 font-medium" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Primary Fishing Port</Label>
                  <Select defaultValue="ratnagiri">
                    <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none px-4 font-medium">
                      <SelectValue placeholder="Select Port" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="ratnagiri">Ratnagiri Port, Maharashtra</SelectItem>
                      <SelectItem value="goa">Panaji Port, Goa</SelectItem>
                      <SelectItem value="kochi">Kochi Port, Kerala</SelectItem>
                      <SelectItem value="mumbai">Sassoon Dock, Mumbai</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button className="rounded-xl h-12 px-8 bg-primary font-bold shadow-lg shadow-primary/20">
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Preferences Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">App Preferences</h2>
          </div>
          
          <Card className="rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold">System Language</h4>
                    <p className="text-sm text-muted-foreground">Select your preferred Indian language</p>
                  </div>
                </div>
                <Select defaultValue="english">
                  <SelectTrigger className="w-40 h-10 rounded-lg border-border font-bold text-xs uppercase tracking-widest">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="hindi">हिन्दी (Hindi)</SelectItem>
                    <SelectItem value="marathi">मराठी (Marathi)</SelectItem>
                    <SelectItem value="malayalam">മലയാളം (Malayalam)</SelectItem>
                    <SelectItem value="tamil">தமிழ் (Tamil)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold">Real-time Notifications</h4>
                    <p className="text-sm text-muted-foreground">Alerts for market prices and migration changes</p>
                  </div>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold">Offline Sync</h4>
                    <p className="text-sm text-muted-foreground">Sync data when moving between sea and land</p>
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Subscription / Billing Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Subscription & Billing</h2>
          </div>
          
          <Card className="rounded-3xl border-none bg-primary text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-12 opacity-10">
              <Shield className="w-48 h-48" />
            </div>
            <CardContent className="p-8 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-4">
                <div className="space-y-1">
                  <Badge className="bg-white/20 text-white border-none font-bold text-[10px] uppercase">Active Plan</Badge>
                  <h3 className="text-3xl font-bold">Premium Fisher Plus</h3>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm font-medium">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                    Unlimited AI Fish Identification
                  </li>
                  <li className="flex items-center gap-2 text-sm font-medium">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                    Advanced Ocean Forecasts (14 days)
                  </li>
                  <li className="flex items-center gap-2 text-sm font-medium">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                    Export Detailed Performance Reports
                  </li>
                </ul>
              </div>
              <div className="flex flex-col gap-3 w-full md:w-auto">
                <Button className="rounded-xl h-14 px-8 bg-white text-primary hover:bg-blue-50 font-bold text-base shadow-lg shadow-black/10">
                  Manage Subscription
                </Button>
                <p className="text-xs text-white/60 text-center">Next billing date: March 15, 2026</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Danger Zone */}
        <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row gap-4 justify-between">
          <Button variant="ghost" className="rounded-xl h-12 px-6 text-red-500 hover:bg-red-500/10 font-bold gap-2">
            <LogOut className="w-5 h-5" />
            Sign Out
          </Button>
          <Button variant="ghost" className="rounded-xl h-12 px-6 text-muted-foreground hover:bg-muted/50 font-bold gap-2">
            <HelpCircle className="w-5 h-5" />
            Help & Documentation
          </Button>
        </div>
      </div>
    </div>
  );
}
