import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { NavbarComponent } from '../../core/components/navbar/navbar.component';
import {
  BookService,
  Resource,
  ResourceType,
} from '../../core/services/book.service';
import { FavoriteService } from '../../core/services/favorite.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../auth/services/auth.service';
import { ImageService } from '../../core/services/image.service';
import { switchMap, catchError, takeUntil } from 'rxjs/operators';
import { of, Subject } from 'rxjs';
import { BorrowDialogComponent } from '../../features/borrowing/borrow-dialog/borrow-dialog.component';
import { BookCopiesComponent } from '../components/book-copies/book-copies.component';
import { BookReviewsComponent } from '../components/book-reviews/book-reviews.component';
import { Location } from '@angular/common';

@Component({
  selector: 'app-book-detail',
  templateUrl: './book-detail.component.html',
  styleUrls: ['./book-detail.component.scss'],
  standalone: true,
  imports: [
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    NavbarComponent,
    BookCopiesComponent,
    BookReviewsComponent
],
})
export class BookDetailComponent implements OnInit, OnDestroy {
  resource: Resource | null = null;
  loading = true;
  error = false;
  isFavorite = false;
  isLoggedIn = false;
  isAdmin = false;
  resourceType = ResourceType;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bookService: BookService,
    private favoriteService: FavoriteService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private dialog: MatDialog,
    public imageService: ImageService,
    private location: Location
  ) {}

  ngOnInit(): void {
    // Vérifier l'état d'authentification (juste pour mettre à jour l'état, pas pour bloquer l'accès)
    this.checkAuthStatus();
    // Charger les détails de la ressource, accessible à tous
    this.loadResourceDetails();
  }

  private checkAuthStatus(): void {
    // Vérifier si l'utilisateur est connecté via le service
    this.authService
      .isAuthenticated()
      .pipe(takeUntil(this.destroy$))
      .subscribe((isAuthenticated) => {
        this.isLoggedIn = isAuthenticated;

        if (isAuthenticated) {
          // Si authentifié, récupérer le profil utilisateur complet
          this.authService
            .getUserProfile()
            .pipe(takeUntil(this.destroy$))
            .subscribe((user) => {
              this.isAdmin = user?.role === 'ADMIN';

              // Si l'utilisateur est connecté et que la ressource est chargée, vérifier l'état des favoris
              if (this.resource) {
                this.checkFavoriteStatus(this.resource.id);
              }
            });
        }
      });
  }

  private loadResourceDetails(): void {
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap((params) => {
          // Réinitialiser l'état de chargement à chaque changement de paramètre
          this.loading = true;
          this.error = false;
          this.resource = null;

          const id = params.get('id');
          if (!id) {
            this.error = true;
            this.loading = false;
            return of(null);
          }
          console.log(`Chargement des détails de la ressource ${id}`);
          return this.bookService.getBookById(id).pipe(
            catchError((error) => {
              console.error(
                `Erreur lors du chargement de la ressource ${id}:`,
                error
              );
              this.error = true;
              this.loading = false;
              this.notificationService.error('Ressource non trouvée');
              return of(null);
            })
          );
        })
      )
      .subscribe((resource) => {
        this.resource = resource;
        this.loading = false;

        if (resource) {
          console.log('Ressource chargée avec succès:', resource);
          console.log('Exemplaires de la ressource:', resource.copies);

          // Afficher la notification pour tous les utilisateurs
          this.notificationService.info(`Vous consultez ${resource.title}`);

          // Vérifier l'état des favoris seulement si l'utilisateur est connecté
          if (this.isLoggedIn) {
            this.checkFavoriteStatus(resource.id);
          }
        }
      });
  }

  private checkFavoriteStatus(resourceId: string): void {
    if (!this.isLoggedIn) return;

    // Utiliser directement l'observable pour suivre les changements
    this.favoriteService
      .observeFavoriteStatus(resourceId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((isFavorite) => {
        if (this.isFavorite !== isFavorite) {
          this.isFavorite = isFavorite;
          console.log(
            'État de favori mis à jour pour la ressource',
            resourceId,
            ':',
            isFavorite
          );
        }
      });

    // Également vérifier via isResourceFavorite pour initialiser si nécessaire
    this.favoriteService
      .isResourceFavorite(resourceId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (isFavorite: boolean) => {
          if (this.isFavorite !== isFavorite) {
            this.isFavorite = isFavorite;
            console.log(
              'État de favori initialisé pour la ressource',
              resourceId,
              ':',
              isFavorite
            );
          }
        },
        error: (error) => {
          console.error(
            'Erreur lors de la vérification du statut de favori:',
            error
          );
          // En cas d'erreur, on garde l'état actuel
        },
      });
  }

  goBack(): void {
    // Utiliser l'historique de navigation pour revenir à la page précédente
    this.location.back();
  }

  toggleFavorite(): void {
    // Vérification de l'authentification uniquement pour les fonctionnalités réservées
    if (!this.isLoggedIn) {
      this.notificationService.warning(
        'Veuillez vous connecter pour ajouter des ressources à vos favoris'
      );
      this.router.navigate(['/auth/login']);
      return;
    }

    if (!this.resource) return;

    // Mettre à jour l'UI immédiatement pour une meilleure réactivité
    const previousState = this.isFavorite;
    this.isFavorite = !this.isFavorite;

    if (!previousState) {
      // Ajouter aux favoris
      this.favoriteService
        .addFavorite(this.resource.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.notificationService.success('Ajouté aux favoris');
          },
          error: (error) => {
            console.error("Erreur lors de l'ajout aux favoris:", error);
            this.notificationService.error(
              "Erreur lors de l'ajout aux favoris"
            );
            // Restaurer l'état précédent en cas d'erreur
            this.isFavorite = previousState;
          },
        });
    } else {
      // Retirer des favoris
      this.favoriteService
        .removeFavorite(this.resource.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.notificationService.info('Retiré des favoris');
          },
          error: (error) => {
            console.error('Erreur lors du retrait des favoris:', error);
            this.notificationService.error(
              'Erreur lors du retrait des favoris'
            );
            // Restaurer l'état précédent en cas d'erreur
            this.isFavorite = previousState;
          },
        });
    }
  }

  borrowResource(): void {
    // Vérification de l'authentification uniquement pour les fonctionnalités réservées
    if (!this.isLoggedIn) {
      this.notificationService.warning(
        'Veuillez vous connecter pour emprunter des ressources'
      );
      this.router.navigate(['/auth/login']);
      return;
    }

    // Vérifier si l'utilisateur est administrateur
    if (!this.isAdmin) {
      this.notificationService.warning(
        'Seuls les administrateurs peuvent attribuer des ressources aux utilisateurs'
      );
      return;
    }

    if (!this.resource) return;

    // Vérifier si la ressource a des exemplaires
    if (!this.resource.copies || this.resource.copies.length === 0) {
      this.notificationService.warning(
        'Aucun exemplaire disponible pour cette ressource'
      );
      return;
    }

    // Vérifier si au moins un exemplaire est disponible
    const availableCopies = this.resource.copies.filter(
      (copy) => copy.available
    );
    if (availableCopies.length === 0) {
      this.notificationService.warning(
        'Tous les exemplaires sont actuellement empruntés'
      );
      return;
    }

    // Ouvrir la fenêtre de dialogue d'emprunt
    const dialogRef = this.dialog.open(BorrowDialogComponent, {
      width: '400px',
      data: {
        resourceId: this.resource.id,
        resourceTitle: this.resource.title,
        copies: this.resource.copies,
      },
    });

    // Gérer le résultat du dialogue
    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (result) {
          // Si le dialogue retourne true, c'est que l'emprunt a été effectué avec succès
          // Recharger les données de la ressource pour mettre à jour les exemplaires disponibles
          this.loadResourceDetails();

          // On peut rediriger vers la liste des emprunts
          this.router.navigate(['/borrowings']);
        }
      });
  }

  /**
   * Obtenir l'URL complète de l'image depuis Supabase
   */
  getCoverUrl(coverImageUrl: string | undefined): string {
    return this.imageService.getSafeImageUrl(coverImageUrl || '');
  }

  /**
   * Gérer les erreurs de chargement d'image
   */
  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = this.imageService.getSafeImageUrl('');
    }
  }

  getResourceIcon(type: ResourceType | undefined): string {
    if (!type) return 'description';

    switch (type) {
      case ResourceType.BOOK:
        return 'book';
      case ResourceType.COMIC:
        return 'import_contacts';
      case ResourceType.DVD:
        return 'movie';
      case ResourceType.GAME:
        return 'sports_esports';
      case ResourceType.MAGAZINE:
        return 'newspaper';
      case ResourceType.AUDIOBOOK:
        return 'headphones';
      default:
        return 'description';
    }
  }

  debugCopies(): void {
    if (this.resource && this.resource.copies) {
      console.log('Exemplaires de la ressource:', this.resource.copies);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
