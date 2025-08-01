import { Component, OnInit } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AuthService } from '../auth/services/auth.service';
import { UserManagementComponent } from './components/user-management/user-management.component';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { User } from '../auth/models/auth.model';
import { CopyManagementComponent } from './components/copy-management/copy-management.component';
import { AssignBorrowingDialogComponent } from './dialogs/assign-borrowing-dialog/assign-borrowing-dialog.component';
import { UserManagementService } from './services/user-management.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatDialogModule,
    UserManagementComponent,
    CopyManagementComponent,
    MatSnackBarModule,
    MatProgressSpinnerModule
],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
})
export class AdminDashboardComponent implements OnInit {
  user: User | null = null;
  loading = true;
  activeTab = 0;
  userCount = 0;

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private userManagementService: UserManagementService
  ) {}

  ngOnInit(): void {
    // Vérifier si nous avons déjà un utilisateur dans le service d'authentification
    this.user = this.authService.currentUser;

    if (this.user) {
      // Si nous avons déjà les données utilisateur, arrêter le chargement
      this.loading = false;
      this.loadUserCount();
    } else {
      // Sinon, charger les données utilisateur
      this.loadUserProfile();
    }
  }

  loadUserCount(): void {
    this.userManagementService.getUserCount().subscribe({
      next: (count) => {
        this.userCount = count;
      },
      error: (error) => {
        console.error(
          "Erreur lors du chargement du nombre d'utilisateurs:",
          error
        );
        this.snackBar.open(
          "Impossible de charger le nombre d'utilisateurs",
          'Fermer',
          {
            duration: 3000,
          }
        );
      },
    });
  }

  loadUserProfile(): void {
    this.loading = true;

    // S'abonner au flux d'utilisateur courant
    this.authService.currentUser$.subscribe({
      next: (user) => {
        if (user) {
          this.user = user;
          this.loading = false;

          // Vérifier si l'utilisateur est bien un admin
          if (user.role?.toLowerCase() !== 'admin') {
            this.snackBar.open(
              "Vous n'avez pas les droits d'accès à cette page",
              'Fermer',
              { duration: 5000 }
            );
            this.router.navigate(['/home']);
          }
        } else {
          // Si toujours pas d'utilisateur, faire un appel réseau
          this.authService.getUserProfile().subscribe({
            next: (userData) => {
              this.user = userData;
              this.loading = false;
            },
            error: (error) => {
              console.error(
                "Erreur lors du chargement du profil de l'utilisateur:",
                error
              );
              this.loading = false;
              this.snackBar.open(
                'Impossible de charger votre profil. Veuillez vous reconnecter.',
                'Fermer',
                { duration: 5000 }
              );
              this.router.navigate(['/auth/login']);
            },
          });
        }
      },
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  changeTab(tabIndex: number): void {
    this.activeTab = tabIndex;
  }

  openAssignBorrowingDialog(): void {
    const dialogRef = this.dialog.open(AssignBorrowingDialogComponent, {
      width: '600px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.snackBar.open('Emprunt attribué avec succès', 'Fermer', {
          duration: 3000,
        });
      }
    });
  }
}
